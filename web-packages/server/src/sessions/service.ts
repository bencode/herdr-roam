import { isAbsolute, relative, resolve } from 'node:path'
import type {
  Project,
  SessionCatalog,
  SessionEntry,
  SessionHistoryDelta,
  SessionHistoryPage,
  SessionProvider,
  SessionSummary,
} from '@herdr-roam/shared'
import { directoryBelongsToWorkspaces, listProjectWorkspaces } from '../projects/workspaces.js'
import {
  findSessionSource,
  readSessionCatalog,
  type SessionCatalogRequest,
  SessionCursorError,
  type SessionRoots,
  type SessionSource,
  summarizeSession,
} from './catalog.js'
import { readClaudeSessionIdentity, readClaudeSessionRange } from './claude.js'
import { readCodexSessionIdentity, readCodexSessionRange } from './codex.js'
import { objectRecord, stringField } from './jsonl.js'
import {
  type PositionedSessionEntry,
  SESSION_HISTORY_MAX_CONTENT_BYTES,
  SESSION_HISTORY_MAX_ENTRIES,
} from './jsonl-range.js'
import { sessionResumeTarget, type SessionResumeTarget } from './resume-target.js'

export type { SessionCatalogRequest, SessionRoots }
export type SessionServiceApi = {
  readonly list: (project: Project, request?: SessionCatalogRequest) => Promise<SessionCatalog>
  readonly resumeTarget: (
    project: Project,
    provider: SessionProvider,
    sessionId: string,
  ) => Promise<SessionResumeTarget | null>
  readonly page: (
    project: Project,
    provider: SessionProvider,
    sessionId: string,
    before?: string,
  ) => Promise<SessionHistoryPage | null>
  readonly delta: (
    project: Project,
    provider: SessionProvider,
    sessionId: string,
    after: string,
  ) => Promise<SessionHistoryDelta | null>
}

export class SessionServiceError extends Error {
  readonly code: 'unavailable' | 'invalid_cursor' | 'history_changed'

  constructor(code: SessionServiceError['code'], message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SessionServiceError'
    this.code = code
  }
}

const validSessionId = (value: string): boolean =>
  value.length <= 512 && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value)

const sourceSummary = ({ filePath: _filePath, ...summary }: SessionSource): SessionSummary =>
  summary

type HistoryCursor = { readonly filePath: string; readonly offset: number }

const encodeHistoryCursor = (source: SessionSource, offset: number): string =>
  Buffer.from(JSON.stringify({ filePath: source.filePath, offset })).toString('base64url')

const decodeHistoryCursor = (cursor: string): HistoryCursor => {
  try {
    const record = objectRecord(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')))
    const filePath = record && stringField(record, 'filePath')
    const offset = record?.offset
    if (!filePath || typeof offset !== 'number' || !Number.isSafeInteger(offset) || offset < 0) {
      throw new Error('Cursor does not identify a valid Session range.')
    }
    return { filePath, offset }
  } catch (error) {
    throw new SessionServiceError(
      'history_changed',
      'The native Session history changed while it was being read.',
      { cause: error },
    )
  }
}

const pathInside = (root: string, path: string): boolean => {
  const relation = relative(resolve(root), resolve(path))
  return relation === '' || (!relation.startsWith('..') && !isAbsolute(relation))
}

const sourceFromCursor = async (
  roots: SessionRoots,
  project: Project,
  provider: SessionProvider,
  sessionId: string,
  cursor: string,
  includeSummary: boolean,
): Promise<{ readonly source: SessionSource; readonly offset: number }> => {
  const decoded = decodeHistoryCursor(cursor)
  const root = provider === 'codex' ? roots.codex : roots.claude
  if (!pathInside(root, decoded.filePath)) {
    throw new SessionServiceError('history_changed', 'The Session history cursor is invalid.')
  }
  const identity =
    provider === 'codex'
      ? await readCodexSessionIdentity(decoded.filePath)
      : await readClaudeSessionIdentity(decoded.filePath)
  const workspaces = await listProjectWorkspaces(project)
  if (
    !identity ||
    identity.id !== sessionId ||
    identity.provider !== provider ||
    !directoryBelongsToWorkspaces(workspaces, identity.cwd)
  ) {
    throw new SessionServiceError(
      'history_changed',
      'The native Session history changed while it was being read.',
    )
  }
  return {
    source: includeSummary
      ? await summarizeSession(identity)
      : { ...identity, title: 'Untitled session' },
    offset: decoded.offset,
  }
}

const entryBytes = (entry: SessionEntry): number => {
  if (entry.kind === 'message') return Buffer.byteLength(entry.text) + entry.attachments.length * 96
  if (entry.kind === 'activity') {
    return Buffer.byteLength(entry.input ?? '') + Buffer.byteLength(entry.output ?? '') + 128
  }
  return 64
}

const boundedPage = (
  entries: readonly PositionedSessionEntry[],
): { readonly entries: readonly SessionEntry[]; readonly firstOffset: number | null } => {
  let index = entries.length
  let count = 0
  let bytes = 0
  while (index > 0) {
    const groupOffset = entries[index - 1]?.offset
    if (groupOffset === undefined) break
    let groupStart = index - 1
    while (groupStart > 0 && entries[groupStart - 1]?.offset === groupOffset) groupStart -= 1
    const group = entries.slice(groupStart, index)
    const groupBytes = group.reduce((total, value) => total + entryBytes(value.entry), 0)
    if (
      count > 0 &&
      (count + group.length > SESSION_HISTORY_MAX_ENTRIES ||
        bytes + groupBytes > SESSION_HISTORY_MAX_CONTENT_BYTES)
    )
      break
    count += group.length
    bytes += groupBytes
    index = groupStart
  }
  const selected = entries.slice(index)
  return { entries: selected.map(value => value.entry), firstOffset: selected[0]?.offset ?? null }
}

const providerRange = (
  source: SessionSource,
  cursor: { readonly before?: number; readonly after?: number },
) =>
  source.provider === 'codex'
    ? readCodexSessionRange(source, cursor)
    : readClaudeSessionRange(source, cursor)

export const createSessionService = (roots: SessionRoots): SessionServiceApi => {
  const source = async (
    project: Project,
    provider: SessionProvider,
    sessionId: string,
  ): Promise<SessionSource | null> => {
    if (!validSessionId(sessionId)) return null
    return findSessionSource(roots, project, provider, sessionId)
  }

  return {
    list: async (project, request = {}) => {
      try {
        return await readSessionCatalog(roots, project, request)
      } catch (error) {
        if (error instanceof SessionCursorError) {
          throw new SessionServiceError('invalid_cursor', error.message, { cause: error })
        }
        throw new SessionServiceError('unavailable', 'Native Session history could not be read.', {
          cause: error,
        })
      }
    },
    resumeTarget: async (project, provider, sessionId) => {
      try {
        const value = await source(project, provider, sessionId)
        return value ? await sessionResumeTarget(value) : null
      } catch (error) {
        throw new SessionServiceError('unavailable', `Session ${sessionId} could not be read.`, {
          cause: error,
        })
      }
    },
    page: async (project, provider, sessionId, before) => {
      try {
        const cursorValue = before
          ? await sourceFromCursor(roots, project, provider, sessionId, before, true)
          : null
        const value = cursorValue?.source ?? (await source(project, provider, sessionId))
        if (!value) return null
        const beforeOffset = cursorValue?.offset
        const range = await providerRange(value, { before: beforeOffset })
        const page = boundedPage(range.entries)
        const olderOffset =
          page.firstOffset !== null && page.firstOffset > range.start
            ? page.firstOffset
            : range.start > 0
              ? range.start
              : null
        return {
          ...sourceSummary(value),
          mode: 'page',
          entries: page.entries,
          olderCursor: olderOffset === null ? null : encodeHistoryCursor(value, olderOffset),
          tailCursor: encodeHistoryCursor(value, range.end),
          atLatest: before === undefined,
        }
      } catch (error) {
        if (error instanceof SessionServiceError) throw error
        if (error instanceof RangeError) {
          throw new SessionServiceError(
            'history_changed',
            'The native Session history changed while it was being read.',
            { cause: error },
          )
        }
        throw new SessionServiceError('unavailable', `Session ${sessionId} could not be read.`, {
          cause: error,
        })
      }
    },
    delta: async (project, provider, sessionId, after) => {
      try {
        const cursorValue = await sourceFromCursor(
          roots,
          project,
          provider,
          sessionId,
          after,
          false,
        )
        const value = cursorValue.source
        const range = await providerRange(value, { after: cursorValue.offset })
        return {
          mode: 'delta',
          entries: range.entries.map(entry => entry.entry),
          activityUpdates: range.activityUpdates,
          tailCursor: encodeHistoryCursor(value, range.end),
          caughtUp: range.caughtUp,
        }
      } catch (error) {
        if (error instanceof SessionServiceError) throw error
        if (error instanceof RangeError) {
          throw new SessionServiceError(
            'history_changed',
            'The native Session history changed while it was being read.',
            { cause: error },
          )
        }
        throw new SessionServiceError('unavailable', `Session ${sessionId} could not be read.`, {
          cause: error,
        })
      }
    },
  }
}
