import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type {
  SessionActivityEntry,
  SessionActivityUpdate,
  SessionAttachment,
  SessionMessageEntry,
  SessionOmissionEntry,
  SessionSummary,
} from '@herdr-roam/shared'
import {
  arrayField,
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

export type CodexSessionIdentity = Omit<SessionSummary, 'title'> & { readonly filePath: string }
export type CodexSessionSource = SessionSummary & { readonly filePath: string }

const internalInput = (text: string): boolean => {
  const value = text.trimStart()
  return (
    value.startsWith('# AGENTS.md instructions') ||
    /^<(?:environment_context|skills_instructions|permissions instructions|collaboration_mode|apps_instructions|plugins_instructions|recommended_plugins)>/.test(
      value,
    )
  )
}

const contentText = (content: readonly unknown[], includeInternal: boolean): string =>
  content
    .flatMap(item => {
      const block = objectRecord(item)
      if (!block) return []
      const type = stringField(block, 'type')
      const text = stringField(block, 'text')
      if ((type !== 'input_text' && type !== 'output_text') || !text) return []
      return !includeInternal && type === 'input_text' && internalInput(text) ? [] : [text]
    })
    .join('\n\n')
    .trim()

const imageAttachments = (
  content: readonly unknown[],
  messageId: string,
): readonly SessionAttachment[] =>
  content.flatMap((item, index) => {
    const block = objectRecord(item)
    if (!block || stringField(block, 'type') !== 'input_image') return []
    const path = stringField(block, 'path')
    return [
      {
        id: `${messageId}:image:${index}`,
        kind: 'image' as const,
        name: path ? basename(path) : 'Image',
      },
    ]
  })

const responsePayload = (record: Record<string, unknown>): Record<string, unknown> | null =>
  stringField(record, 'type') === 'response_item' ? objectRecord(record.payload) : null

export const readCodexSessionIdentity = async (
  filePath: string,
): Promise<CodexSessionIdentity | null> => {
  for await (const value of readJsonl(filePath, SESSION_SUMMARY_MAX_BYTES)) {
    const record = objectRecord(value)
    const payload = record && objectRecord(record.payload)
    if (!record || stringField(record, 'type') !== 'session_meta' || !payload) continue
    const source = objectRecord(payload.source)
    if (source && objectRecord(source.subagent)) return null
    const id = stringField(payload, 'id') ?? stringField(payload, 'session_id')
    const cwd = stringField(payload, 'cwd')
    if (!id || !cwd) return null
    const metadata = await stat(filePath)
    return {
      id,
      provider: 'codex',
      cwd,
      createdAt: stringField(record, 'timestamp') ?? stringField(payload, 'timestamp'),
      updatedAt: metadata.mtime.toISOString(),
      filePath,
    }
  }
  return null
}

export const summarizeCodexSession = async (
  identity: CodexSessionIdentity,
): Promise<CodexSessionSource> => {
  let firstPrompt: string | null = null
  for await (const value of readJsonl(identity.filePath, SESSION_SUMMARY_MAX_BYTES)) {
    const record = objectRecord(value)
    const payload = record && objectRecord(record.payload)
    if (
      payload &&
      stringField(payload, 'type') === 'message' &&
      stringField(payload, 'role') === 'user'
    ) {
      firstPrompt = contentText(arrayField(payload, 'content'), false) || null
      if (firstPrompt) break
    }
  }
  return { ...identity, title: displayTitle(firstPrompt) }
}

export const discoverCodexSessionIdentities = async (
  root: string,
): Promise<readonly CodexSessionIdentity[]> =>
  (
    await mapConcurrent(
      await jsonlFiles(root),
      SESSION_DISCOVERY_CONCURRENCY,
      readCodexSessionIdentity,
    )
  ).filter((session): session is CodexSessionIdentity => session !== null)

const activityName = (payload: Record<string, unknown>): string =>
  stringField(payload, 'name') ?? stringField(payload, 'type') ?? 'Tool'

const callIdentifier = (payload: Record<string, unknown>, fallback: string): string =>
  stringField(payload, 'call_id') ?? stringField(payload, 'id') ?? fallback

const omission = (
  source: CodexSessionSource,
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
  source: CodexSessionSource,
  record: JsonlRangeRecord,
  payload: Record<string, unknown>,
  createdAt: string | null,
): PositionedSessionEntry | null => {
  const role = stringField(payload, 'role')
  if (role !== 'user' && role !== 'assistant') return null
  const id = stringField(payload, 'id') ?? `${source.id}:message:${record.start}`
  const content = arrayField(payload, 'content')
  const text = contentText(content, role === 'assistant')
  const attachments = role === 'user' ? imageAttachments(content, id) : []
  if (!text && attachments.length === 0) return null
  if (Buffer.byteLength(text) > SESSION_HISTORY_MAX_CONTENT_BYTES) return omission(source, record)
  const entry: SessionMessageEntry = { kind: 'message', id, role, text, createdAt, attachments }
  return { offset: record.start, entry }
}

const parseCodexRange = (source: CodexSessionSource, range: JsonlRange): ProviderRangeContent => {
  const entries: PositionedSessionEntry[] = []
  const activities = new Map<string, number>()
  const activityUpdates: SessionActivityUpdate[] = []

  range.records.forEach(record => {
    if (record.omitted || !record.value) {
      entries.push(omission(source, record))
      return
    }
    const value = objectRecord(record.value)
    const payload = value && responsePayload(value)
    if (!value || !payload) return
    const payloadType = stringField(payload, 'type')
    const createdAt = stringField(value, 'timestamp')
    if (payloadType === 'message') {
      const message = messageEntry(source, record, payload, createdAt)
      if (message) entries.push(message)
      return
    }
    if (
      payloadType === 'function_call' ||
      payloadType === 'custom_tool_call' ||
      payloadType === 'local_shell_call'
    ) {
      const id = callIdentifier(payload, `${source.id}:activity:${record.start}`)
      const entry: SessionActivityEntry = {
        kind: 'activity',
        id,
        name: activityName(payload),
        status: stringField(payload, 'status') === 'completed' ? 'completed' : 'pending',
        input: displayValue(payload.arguments ?? payload.input ?? payload.action),
        output: null,
        createdAt,
      }
      activities.set(id, entries.length)
      entries.push({ offset: record.start, entry })
      return
    }
    if (
      payloadType !== 'function_call_output' &&
      payloadType !== 'custom_tool_call_output' &&
      payloadType !== 'local_shell_call_output'
    )
      return
    const id = callIdentifier(payload, '')
    const status = stringField(payload, 'status') === 'failed' ? 'failed' : 'completed'
    const output = displayValue(payload.output)
    const index = activities.get(id)
    if (index === undefined) {
      activityUpdates.push({ id, status, output })
      return
    }
    const current = entries[index]
    if (current?.entry.kind !== 'activity') return
    entries[index] = { ...current, entry: { ...current.entry, status, output } }
  })

  return { ...range, entries, activityUpdates }
}

export const readCodexSessionRange = async (
  source: CodexSessionSource,
  cursor: { readonly before?: number; readonly after?: number },
): Promise<ProviderRangeContent> =>
  parseCodexRange(
    source,
    cursor.after === undefined
      ? await readJsonlBackwardRange(source.filePath, cursor.before)
      : await readJsonlForwardRange(source.filePath, cursor.after),
  )
