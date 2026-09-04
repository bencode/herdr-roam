import type { Project, SessionCatalog, SessionProvider, SessionSummary } from '@herdr-roam/shared'
import { directoryBelongsToWorkspaces, listProjectWorkspaces } from '../projects/workspaces.js'
import {
  type ClaudeSessionIdentity,
  type ClaudeSessionSource,
  discoverClaudeSessionIdentities,
  summarizeClaudeSession,
} from './claude.js'
import {
  type CodexSessionIdentity,
  type CodexSessionSource,
  discoverCodexSessionIdentities,
  summarizeCodexSession,
} from './codex.js'
import { mapConcurrent, objectRecord, stringField } from './jsonl.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100
const SUMMARY_CONCURRENCY = 16

export type SessionRoots = {
  readonly codex: string
  readonly claude: string
}

export type SessionIdentity = CodexSessionIdentity | ClaudeSessionIdentity
export type SessionSource = CodexSessionSource | ClaudeSessionSource

export type SessionCatalogRequest = {
  readonly cursor?: string
  readonly limit?: number
  readonly query?: string
  readonly signal?: AbortSignal
}

export class SessionCursorError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SessionCursorError'
  }
}

const sourceSummary = ({ filePath: _filePath, ...summary }: SessionSource): SessionSummary =>
  summary

const sortSources = <Source extends SessionIdentity>(
  values: readonly Source[],
): readonly Source[] =>
  values.toSorted(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) ||
      left.provider.localeCompare(right.provider) ||
      left.id.localeCompare(right.id),
  )

const uniqueSources = (sources: readonly SessionIdentity[]): readonly SessionIdentity[] => [
  ...sortSources(sources)
    .reduce((unique, source) => {
      const key = `${source.provider}:${source.id}`
      if (!unique.has(key)) unique.set(key, source)
      return unique
    }, new Map<string, SessionIdentity>())
    .values(),
]

const ensureActive = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw signal.reason ?? new Error('Session request was cancelled.')
}

export const discoverSessionIdentities = async (
  roots: SessionRoots,
  signal?: AbortSignal,
): Promise<readonly SessionIdentity[]> => {
  ensureActive(signal)
  const [codex, claude] = await Promise.all([
    discoverCodexSessionIdentities(roots.codex),
    discoverClaudeSessionIdentities(roots.claude),
  ])
  ensureActive(signal)
  return uniqueSources([...codex, ...claude])
}

export const summarizeSession = (identity: SessionIdentity): Promise<SessionSource> =>
  identity.provider === 'codex' ? summarizeCodexSession(identity) : summarizeClaudeSession(identity)

type CatalogCursor = { readonly provider: SessionProvider; readonly id: string }

const encodeCursor = (source: SessionIdentity): string =>
  Buffer.from(JSON.stringify({ provider: source.provider, id: source.id })).toString('base64url')

const decodeCursor = (value: string): CatalogCursor => {
  try {
    const record = objectRecord(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')))
    const provider = record && stringField(record, 'provider')
    const id = record && stringField(record, 'id')
    if ((provider !== 'codex' && provider !== 'claude') || !id) throw new Error('Invalid cursor')
    return { provider, id }
  } catch (error) {
    throw new SessionCursorError('The Session catalog cursor is invalid.', { cause: error })
  }
}

const cursorIndex = (values: readonly SessionIdentity[], cursor?: string): number => {
  if (!cursor) return 0
  const decoded = decodeCursor(cursor)
  const index = values.findIndex(
    source => source.provider === decoded.provider && source.id === decoded.id,
  )
  if (index < 0) throw new SessionCursorError('The Session catalog changed while paging.')
  return index + 1
}

const normalizedLimit = (limit?: number): number =>
  Math.min(MAX_LIMIT, Math.max(1, limit ?? DEFAULT_LIMIT))

const matchesQuery = (query: string, summary: SessionSummary): boolean => {
  const normalized = query.trim().toLowerCase()
  return (
    normalized === '' ||
    summary.provider.includes(normalized) ||
    summary.title.toLowerCase().includes(normalized)
  )
}

export const readSessionCatalog = async (
  roots: SessionRoots,
  project: Project,
  request: SessionCatalogRequest,
): Promise<SessionCatalog> => {
  const workspaces = await listProjectWorkspaces(project)
  const identities = (await discoverSessionIdentities(roots, request.signal)).filter(identity =>
    directoryBelongsToWorkspaces(workspaces, identity.cwd),
  )
  ensureActive(request.signal)
  const query = request.query?.trim() ?? ''
  const summaries = query
    ? await mapConcurrent(identities, SUMMARY_CONCURRENCY, async identity => {
        ensureActive(request.signal)
        return summarizeSession(identity)
      })
    : null
  const candidates: readonly SessionIdentity[] = summaries
    ? summaries.filter(summary => matchesQuery(query, summary))
    : identities
  ensureActive(request.signal)
  const start = cursorIndex(candidates, request.cursor)
  const limit = normalizedLimit(request.limit)
  const page = candidates.slice(start, start + limit)
  const sources: readonly SessionSource[] = summaries
    ? summaries.filter(summary =>
        page.some(value => value.provider === summary.provider && value.id === summary.id),
      )
    : await mapConcurrent(page, SUMMARY_CONCURRENCY, summarizeSession)
  const last = page.at(-1)
  return {
    items: sources.map(sourceSummary),
    total: candidates.length,
    nextCursor: start + page.length < candidates.length && last ? encodeCursor(last) : null,
  }
}

export const findSessionSource = async (
  roots: SessionRoots,
  project: Project,
  provider: SessionProvider,
  sessionId: string,
  signal?: AbortSignal,
): Promise<SessionSource | null> => {
  const workspaces = await listProjectWorkspaces(project)
  const identity = (await discoverSessionIdentities(roots, signal)).find(
    candidate =>
      candidate.provider === provider &&
      candidate.id === sessionId &&
      directoryBelongsToWorkspaces(workspaces, candidate.cwd),
  )
  return identity ? summarizeSession(identity) : null
}
