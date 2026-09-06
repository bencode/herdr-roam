import type { IssueApiError, IssueCatalog, IssueDetail } from '@herdr-roam/shared'
import { z } from 'zod'
import { issueCatalogSchema, issueDetailSchema } from './schema'

const errorSchema = z.object({
  error: z.object({
    code: z.enum([
      'issue_store_not_configured',
      'invalid_issue_config',
      'issue_store_unavailable',
      'invalid_issue',
      'issue_not_found',
      'issue_unavailable',
      'issue_catalog_too_large',
      'project_not_found',
      'project_directory_unavailable',
      'workspace_not_found',
      'workspace_directory_unavailable',
      'workspace_unavailable',
      'internal_error',
    ]),
    message: z.string().min(1),
  }),
})

export class IssueClientError extends Error {
  readonly code: IssueApiError['error']['code'] | 'invalid_response' | 'network_error'

  constructor(code: IssueClientError['code'], message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'IssueClientError'
    this.code = code
  }
}

const issueRoot = (projectName: string, workspaceId: string): string =>
  `/api/projects/${encodeURIComponent(projectName)}/workspaces/${encodeURIComponent(workspaceId)}/issues`

const request = async <Value>(
  path: string,
  parse: (body: unknown) => Value,
  signal?: AbortSignal,
): Promise<Value> => {
  try {
    const response = await fetch(path, { signal })
    let body: unknown
    try {
      body = await response.json()
    } catch (error) {
      throw new IssueClientError('invalid_response', 'The server returned invalid JSON.', {
        cause: error,
      })
    }
    if (!response.ok) {
      const parsed = errorSchema.safeParse(body)
      if (parsed.success)
        throw new IssueClientError(parsed.data.error.code, parsed.data.error.message)
      throw new IssueClientError('invalid_response', `The server returned HTTP ${response.status}.`)
    }
    try {
      return parse(body)
    } catch (error) {
      throw new IssueClientError('invalid_response', 'The server returned invalid Issue data.', {
        cause: error,
      })
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    if (error instanceof IssueClientError) throw error
    throw new IssueClientError('network_error', 'Herdr Roam could not be reached.', {
      cause: error,
    })
  }
}

export const fetchIssues = (
  projectName: string,
  workspaceId: string,
  signal?: AbortSignal,
): Promise<IssueCatalog> =>
  request(issueRoot(projectName, workspaceId), issueCatalogSchema.parse, signal)

export const fetchIssue = (
  projectName: string,
  workspaceId: string,
  issueId: string,
  signal?: AbortSignal,
): Promise<IssueDetail> =>
  request(
    `${issueRoot(projectName, workspaceId)}/${encodeURIComponent(issueId)}`,
    issueDetailSchema.parse,
    signal,
  )
