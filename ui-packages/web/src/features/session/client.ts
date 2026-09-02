import type {
  SessionApiError,
  SessionCatalog,
  SessionHistoryDelta,
  SessionHistoryPage,
  SessionProvider,
  SessionResumeReceipt,
} from '@herdr-roam/shared'
import { z } from 'zod'

const providerSchema = z.enum(['codex', 'claude'])
const agentStatusSchema = z.enum(['blocked', 'working', 'idle', 'done', 'unknown'])
const agentSessionSchema = z.object({
  source: z.string().min(1),
  agent: z.string().min(1),
  kind: z.enum(['id', 'path']),
  value: z.string().min(1),
})
const agentSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: z.string().min(1).nullable(),
  status: agentStatusSchema,
  cwd: z.string().min(1).nullable(),
  attachTarget: z.string().min(1),
  session: agentSessionSchema.nullable(),
})
const summarySchema = z.object({
  id: z.string().min(1),
  provider: providerSchema,
  title: z.string().min(1),
  cwd: z.string().min(1),
  createdAt: z.string().min(1).nullable(),
  updatedAt: z.string().min(1),
})
const attachmentSchema = z.object({
  id: z.string().min(1),
  kind: z.literal('image'),
  name: z.string().min(1),
})
const entrySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('message'),
    id: z.string().min(1),
    role: z.enum(['user', 'assistant']),
    text: z.string(),
    createdAt: z.string().min(1).nullable(),
    attachments: z.array(attachmentSchema).readonly(),
  }),
  z.object({
    kind: z.literal('activity'),
    id: z.string().min(1),
    name: z.string().min(1),
    status: z.enum(['pending', 'completed', 'failed']),
    input: z.string().nullable(),
    output: z.string().nullable(),
    createdAt: z.string().min(1).nullable(),
  }),
  z.object({
    kind: z.literal('omission'),
    id: z.string().min(1),
    bytes: z.number().int().positive(),
    createdAt: z.null(),
  }),
])
const catalogSchema = z.object({
  items: z.array(summarySchema).readonly(),
  total: z.number().int().nonnegative(),
  nextCursor: z.string().min(1).nullable(),
})
const pageSchema = summarySchema.extend({
  mode: z.literal('page'),
  entries: z.array(entrySchema).readonly(),
  olderCursor: z.string().min(1).nullable(),
  tailCursor: z.string().min(1),
  atLatest: z.boolean(),
})
const activityUpdateSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'completed', 'failed']),
  output: z.string().nullable(),
})
const deltaSchema = z.object({
  mode: z.literal('delta'),
  entries: z.array(entrySchema).readonly(),
  activityUpdates: z.array(activityUpdateSchema).readonly(),
  tailCursor: z.string().min(1),
  caughtUp: z.boolean(),
})
const resumeSchema = z.object({ agent: agentSummarySchema, reused: z.boolean() })
const recoverySchema = z.object({
  phase: z.enum(['agent_start', 'agent_ready', 'initial_prompt']),
  workspaceId: z.string().min(1),
  paneId: z.string().min(1),
  terminalId: z.string().min(1),
  agentId: z.string().min(1).optional(),
  attachCommand: z.string().min(1),
})
const errorSchema = z.object({
  error: z.object({
    code: z.enum([
      'invalid_session',
      'session_not_found',
      'session_history_unavailable',
      'session_history_changed',
      'session_directory_unavailable',
      'session_resume_unavailable',
      'runtime_unavailable',
      'project_not_found',
      'internal_error',
    ]),
    message: z.string().min(1),
    recovery: recoverySchema.optional(),
  }),
})

export class SessionClientError extends Error {
  readonly code: SessionApiError['error']['code'] | 'invalid_response' | 'network_error'
  readonly recovery: SessionApiError['error']['recovery'] | null

  constructor(
    code: SessionClientError['code'],
    message: string,
    recovery: SessionClientError['recovery'] = null,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'SessionClientError'
    this.code = code
    this.recovery = recovery
  }
}

const responseValue = async <Value>(
  response: Response,
  parse: (value: unknown) => Value,
): Promise<Value> => {
  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    throw new SessionClientError('invalid_response', 'The server returned invalid JSON.', null, {
      cause: error,
    })
  }
  if (!response.ok) {
    const parsed = errorSchema.safeParse(body)
    if (parsed.success) {
      throw new SessionClientError(
        parsed.data.error.code,
        parsed.data.error.message,
        parsed.data.error.recovery ?? null,
      )
    }
    throw new SessionClientError('invalid_response', `The server returned HTTP ${response.status}.`)
  }
  try {
    return parse(body)
  } catch (error) {
    throw new SessionClientError(
      'invalid_response',
      'The server returned invalid Session data.',
      null,
      {
        cause: error,
      },
    )
  }
}

const sessionPath = (
  projectName: string,
  provider?: SessionProvider,
  sessionId?: string,
): string => {
  const root = `/api/projects/${encodeURIComponent(projectName)}/sessions`
  return provider && sessionId
    ? `${root}/${encodeURIComponent(provider)}/${encodeURIComponent(sessionId)}`
    : root
}

const request = async <Value>(
  input: string,
  parse: (value: unknown) => Value,
  init?: RequestInit,
): Promise<Value> => {
  try {
    return await responseValue(await fetch(input, init), parse)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    if (error instanceof SessionClientError) throw error
    throw new SessionClientError('network_error', 'Herdr Roam could not be reached.', null, {
      cause: error,
    })
  }
}

export type SessionCatalogOptions = {
  readonly cursor?: string
  readonly limit?: number
  readonly query?: string
  readonly signal?: AbortSignal
}

const withQuery = (
  path: string,
  values: Readonly<Record<string, string | number | undefined>>,
): string => {
  const query = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value))
  })
  const suffix = query.toString()
  return suffix ? `${path}?${suffix}` : path
}

export const fetchProjectSessions = (
  projectName: string,
  options: SessionCatalogOptions = {},
): Promise<SessionCatalog> =>
  request(
    withQuery(sessionPath(projectName), {
      cursor: options.cursor,
      limit: options.limit,
      query: options.query,
    }),
    catalogSchema.parse,
    { signal: options.signal },
  )

export const fetchSessionPage = (
  projectName: string,
  provider: SessionProvider,
  sessionId: string,
  before?: string,
  signal?: AbortSignal,
): Promise<SessionHistoryPage> =>
  request(withQuery(sessionPath(projectName, provider, sessionId), { before }), pageSchema.parse, {
    signal,
  })

export const fetchSessionDelta = (
  projectName: string,
  provider: SessionProvider,
  sessionId: string,
  after: string,
  signal?: AbortSignal,
): Promise<SessionHistoryDelta> =>
  request(withQuery(sessionPath(projectName, provider, sessionId), { after }), deltaSchema.parse, {
    signal,
  })

export const resumeSession = (
  projectName: string,
  provider: SessionProvider,
  sessionId: string,
): Promise<SessionResumeReceipt> =>
  request(`${sessionPath(projectName, provider, sessionId)}/resume`, resumeSchema.parse, {
    method: 'POST',
  })
