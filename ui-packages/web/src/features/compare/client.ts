import type {
  CompareApiError,
  CompareBranches,
  CompareFileView,
  Comparison,
} from '@herdr-roam/shared'
import { z } from 'zod'

const branch = z.object({ ref: z.string(), name: z.string(), oid: z.string() })
const entry = z.object({
  oldPath: z.string().nullable(),
  newPath: z.string().nullable(),
  oldMode: z
    .string()
    .regex(/^[0-7]{6}$/)
    .nullable(),
  newMode: z
    .string()
    .regex(/^[0-7]{6}$/)
    .nullable(),
  status: z.enum(['added', 'modified', 'deleted', 'renamed', 'type-changed']),
  added: z.number().nullable(),
  removed: z.number().nullable(),
})
const committedText = z.object({ path: z.string(), content: z.string() })
const branches = z.object({ items: z.array(branch), defaultTargetRef: z.string().nullable() })
const comparison = z.object({
  source: branch,
  target: branch,
  baseOid: z.string(),
  files: z.array(entry),
})
const file = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text'),
    entry,
    oldFile: committedText.nullable(),
    newFile: committedText.nullable(),
  }),
  z.object({
    kind: z.literal('unavailable'),
    entry,
    reason: z.enum(['binary', 'oversized', 'submodule']),
  }),
])
const failure: z.ZodType<CompareApiError> = z.object({
  error: z.object({
    code: z.enum([
      'invalid_query',
      'project_not_found',
      'repository_unavailable',
      'ref_not_found',
      'no_merge_base',
      'file_not_found',
      'comparison_too_large',
      'git_timeout',
      'internal_error',
    ]),
    message: z.string(),
  }),
})

type ClientErrorCode = CompareApiError['error']['code'] | 'invalid_response' | 'network_error'

export class CompareClientError extends Error {
  constructor(
    readonly code: ClientErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'CompareClientError'
  }
}

const request = async <Value>(
  path: string,
  schema: z.ZodType<Value>,
  signal?: AbortSignal,
): Promise<Value> => {
  try {
    const response = await fetch(path, { signal })
    const body: unknown = await response.json()
    if (!response.ok) {
      const error = failure.safeParse(body)
      throw new CompareClientError(
        error.success ? error.data.error.code : 'invalid_response',
        error.success ? error.data.error.message : `The server returned HTTP ${response.status}.`,
      )
    }
    const result = schema.safeParse(body)
    if (!result.success)
      throw new CompareClientError(
        'invalid_response',
        'The server returned invalid comparison data.',
        { cause: result.error },
      )
    return result.data
  } catch (error) {
    if (signal?.aborted || error instanceof CompareClientError) throw error
    throw new CompareClientError(
      'network_error',
      'The comparison could not be loaded. Check the server and try again.',
      { cause: error },
    )
  }
}

const root = (projectName: string) => `/api/projects/${encodeURIComponent(projectName)}`

export const fetchCompareBranches = (
  projectName: string,
  signal?: AbortSignal,
): Promise<CompareBranches> => request(`${root(projectName)}/branches`, branches, signal)
export const fetchComparison = (
  projectName: string,
  sourceRef: string,
  targetRef: string,
  signal?: AbortSignal,
): Promise<Comparison> =>
  request(
    `${root(projectName)}/compare?${new URLSearchParams({ sourceRef, targetRef })}`,
    comparison,
    signal,
  )
export const fetchComparisonFile = (
  projectName: string,
  baseOid: string,
  sourceOid: string,
  path: string,
  signal?: AbortSignal,
): Promise<CompareFileView> =>
  request(
    `${root(projectName)}/compare/file?${new URLSearchParams({ baseOid, sourceOid, path })}`,
    file,
    signal,
  )
