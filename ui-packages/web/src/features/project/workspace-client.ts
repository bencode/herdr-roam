import type { ProjectApiError, ProjectWorkspaceCatalog } from '@herdr-roam/shared'
import { z } from 'zod'
import { workspaceCatalogSchema } from './workspace-schema'

const errorSchema = z.object({
  error: z.object({
    code: z.enum([
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

export class WorkspaceClientError extends Error {
  readonly code:
    | ProjectApiError['error']['code']
    | 'workspace_not_found'
    | 'workspace_directory_unavailable'
    | 'invalid_response'
    | 'network_error'

  constructor(code: WorkspaceClientError['code'], message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'WorkspaceClientError'
    this.code = code
  }
}

export const fetchProjectWorkspaces = async (
  projectName: string,
  signal?: AbortSignal,
): Promise<ProjectWorkspaceCatalog> => {
  try {
    const response = await fetch(`/api/projects/${encodeURIComponent(projectName)}/workspaces`, {
      signal,
    })
    let body: unknown
    try {
      body = await response.json()
    } catch (error) {
      throw new WorkspaceClientError('invalid_response', 'The server returned invalid JSON.', {
        cause: error,
      })
    }
    if (!response.ok) {
      const parsed = errorSchema.safeParse(body)
      if (parsed.success) {
        throw new WorkspaceClientError(parsed.data.error.code, parsed.data.error.message)
      }
      throw new WorkspaceClientError(
        'invalid_response',
        `The server returned HTTP ${response.status}.`,
      )
    }
    try {
      return workspaceCatalogSchema.parse(body)
    } catch (error) {
      throw new WorkspaceClientError(
        'invalid_response',
        'The server returned invalid Workspace data.',
        { cause: error },
      )
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    if (error instanceof WorkspaceClientError) throw error
    throw new WorkspaceClientError('network_error', 'Herdr Roam could not be reached.', {
      cause: error,
    })
  }
}
