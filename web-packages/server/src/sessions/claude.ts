import { stat } from 'node:fs/promises'
import { sep } from 'node:path'
import type {
  SessionActivityEntry,
  SessionActivityUpdate,
  SessionAttachment,
  SessionMessageEntry,
  SessionOmissionEntry,
  SessionSummary,
} from '@herdr-roam/shared'
import {
  booleanField,
  displayTitle,
  displayValue,
  jsonlFiles,
  mapConcurrent,
  objectRecord,
  readJsonl,
  stringField,
} from './jsonl.js'
import {
  type JsonlRange,
  type JsonlRangeRecord,
  type PositionedSessionEntry,
  type ProviderRangeContent,
  readJsonlBackwardRange,
  readJsonlForwardRange,
  SESSION_HISTORY_MAX_CONTENT_BYTES,
} from './jsonl-range.js'

const SESSION_SUMMARY_MAX_BYTES = 4 * 1024 * 1024
const SESSION_DISCOVERY_CONCURRENCY = 32

export type ClaudeSessionIdentity = Omit<SessionSummary, 'title'> & { readonly filePath: string }
export type ClaudeSessionSource = SessionSummary & { readonly filePath: string }

const isSubagent = (path: string): boolean => path.split(sep).includes('subagents')

const messageRecord = (record: Record<string, unknown>): Record<string, unknown> | null => {
  if (booleanField(record, 'isSidechain') === true) return null
  const type = stringField(record, 'type')
  return type === 'user' || type === 'assistant' ? objectRecord(record.message) : null
}

const textBlocks = (content: unknown): string => {
  if (typeof content === 'string') return content.trim()
  return (Array.isArray(content) ? content : [])
    .flatMap(item => {
      const block = objectRecord(item)
      return block && stringField(block, 'type') === 'text'
        ? [stringField(block, 'text') ?? '']
        : []
    })
    .filter(Boolean)
    .join('\n\n')
    .trim()
}

export const readClaudeSessionIdentity = async (
  filePath: string,
): Promise<ClaudeSessionIdentity | null> => {
  if (isSubagent(filePath)) return null
  for await (const value of readJsonl(filePath, SESSION_SUMMARY_MAX_BYTES)) {
    const record = objectRecord(value)
    if (!record || booleanField(record, 'isSidechain') === true) continue
    const id = stringField(record, 'sessionId') ?? stringField(record, 'session_id')
    const cwd = stringField(record, 'cwd')
    if (!id || !cwd) continue
    const metadata = await stat(filePath)
    return {
      id,
      provider: 'claude',
      cwd,
      createdAt: stringField(record, 'timestamp'),
      updatedAt: metadata.mtime.toISOString(),
      filePath,
    }
  }
  return null
}

export const summarizeClaudeSession = async (
  identity: ClaudeSessionIdentity,
): Promise<ClaudeSessionSource> => {
  let firstPrompt: string | null = null
  for await (const value of readJsonl(identity.filePath, SESSION_SUMMARY_MAX_BYTES)) {
    const record = objectRecord(value)
    if (!record || booleanField(record, 'isSidechain') === true) continue
    if (stringField(record, 'type') === 'user') {
      firstPrompt = textBlocks(objectRecord(record.message)?.content) || null
      if (firstPrompt) break
    }
  }
  return { ...identity, title: displayTitle(firstPrompt) }
}

export const discoverClaudeSessionIdentities = async (
  root: string,
): Promise<readonly ClaudeSessionIdentity[]> =>
  (
    await mapConcurrent(
      (await jsonlFiles(root)).filter(path => !isSubagent(path)),
      SESSION_DISCOVERY_CONCURRENCY,
      readClaudeSessionIdentity,
    )
  ).filter((session): session is ClaudeSessionIdentity => session !== null)

const imageAttachments = (
  content: readonly unknown[],
  messageId: string,
): readonly SessionAttachment[] =>
  content.flatMap((item, index) => {
    const block = objectRecord(item)
    if (!block || stringField(block, 'type') !== 'image') return []
    return [{ id: `${messageId}:image:${index}`, kind: 'image' as const, name: 'Image' }]
  })

const omission = (
  source: ClaudeSessionSource,
  record: JsonlRangeRecord,
): PositionedSessionEntry => ({
  offset: record.start,
  entry: {
    kind: 'omission',
    id: `${source.id}:omission:${record.start}`,
    bytes: record.bytes,
    createdAt: null,
  } satisfies SessionOmissionEntry,
})

const messageEntry = (
  source: ClaudeSessionSource,
  record: JsonlRangeRecord,
  message: Record<string, unknown>,
  createdAt: string | null,
): PositionedSessionEntry | null => {
  const role = stringField(message, 'role')
  if (role !== 'user' && role !== 'assistant') return null
  const content = message.content
  const blocks = Array.isArray(content) ? content : []
  const text = textBlocks(content)
  const value = objectRecord(record.value)
  const id = (value && stringField(value, 'uuid')) ?? `${source.id}:message:${record.start}`
  const attachments = role === 'user' ? imageAttachments(blocks, id) : []
  if (!text && attachments.length === 0) return null
  if (Buffer.byteLength(text) > SESSION_HISTORY_MAX_CONTENT_BYTES) return omission(source, record)
  const entry: SessionMessageEntry = { kind: 'message', id, role, text, createdAt, attachments }
  return { offset: record.start, entry }
}

const parseClaudeRange = (source: ClaudeSessionSource, range: JsonlRange): ProviderRangeContent => {
  const entries: PositionedSessionEntry[] = []
  const activities = new Map<string, number>()
  const activityUpdates: SessionActivityUpdate[] = []

  range.records.forEach(record => {
    if (record.omitted || !record.value) {
      entries.push(omission(source, record))
      return
    }
    const value = objectRecord(record.value)
    const message = value && messageRecord(value)
    if (!value || !message) return
    const createdAt = stringField(value, 'timestamp')
    const messageValue = messageEntry(source, record, message, createdAt)
    if (messageValue) entries.push(messageValue)

    const content = message.content
    const blocks = Array.isArray(content) ? content : []
    blocks.forEach((item, index) => {
      const block = objectRecord(item)
      if (!block) return
      const type = stringField(block, 'type')
      if (type === 'tool_use') {
        const id = stringField(block, 'id') ?? `${source.id}:activity:${record.start}:${index}`
        const entry: SessionActivityEntry = {
          kind: 'activity',
          id,
          name: stringField(block, 'name') ?? 'Tool',
          status: 'pending',
          input: displayValue(block.input),
          output: null,
          createdAt,
        }
        activities.set(id, entries.length)
        entries.push({ offset: record.start, entry })
        return
      }
      if (type !== 'tool_result') return
      const id = stringField(block, 'tool_use_id') ?? ''
      const status = booleanField(block, 'is_error') === true ? 'failed' : 'completed'
      const output = displayValue(block.content)
      const activityIndex = activities.get(id)
      if (activityIndex === undefined) {
        activityUpdates.push({ id, status, output })
        return
      }
      const current = entries[activityIndex]
      if (current?.entry.kind !== 'activity') return
      entries[activityIndex] = { ...current, entry: { ...current.entry, status, output } }
    })
  })

  return { ...range, entries, activityUpdates }
}

export const readClaudeSessionRange = async (
  source: ClaudeSessionSource,
  cursor: { readonly before?: number; readonly after?: number },
): Promise<ProviderRangeContent> =>
  parseClaudeRange(
    source,
    cursor.after === undefined
      ? await readJsonlBackwardRange(source.filePath, cursor.before)
      : await readJsonlForwardRange(source.filePath, cursor.after),
  )
