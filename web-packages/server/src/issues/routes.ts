import type { IssueApiError } from '@herdr-roam/shared'
import { Hono } from 'hono'
import type { ProjectRegistryApi } from '../projects/registry.js'
import { ProjectRegistryError } from '../projects/registry.js'
import { ProjectWorkspaceError, resolveProjectWorkspace } from '../projects/workspaces.js'
import { listIssues, readIssue } from './catalog.js'
import { IssueError } from './storage.js'

type ErrorCode = IssueApiError['error']['code']

const errorBody = (code: ErrorCode, message: string): IssueApiError => ({
  error: { code, message },
})

const errorStatus = (code: ErrorCode): 404 | 409 | 413 | 500 | 503 => {
  if (
    code === 'project_not_found' ||
    code === 'workspace_not_found' ||
    code === 'issue_store_not_configured' ||
    code === 'issue_not_found'
  ) {
    return 404
  }
  if (code === 'issue_catalog_too_large') return 413
  if (code === 'workspace_unavailable') return 503
  if (code === 'internal_error') return 500
  return 409
}

const failure = (
  error: unknown,
): { readonly body: IssueApiError; readonly status: ReturnType<typeof errorStatus> } => {
  if (error instanceof IssueError) {
    return { body: errorBody(error.code, error.message), status: errorStatus(error.code) }
  }
  if (error instanceof ProjectRegistryError) {
    const code: ErrorCode =
      error.code === 'project_not_found'
        ? 'project_not_found'
        : error.code === 'project_directory_unavailable'
          ? 'project_directory_unavailable'
          : 'internal_error'
    return { body: errorBody(code, error.message), status: errorStatus(code) }
  }
  if (error instanceof ProjectWorkspaceError) {
    const code: ErrorCode =
      error.code === 'project_directory_unavailable'
        ? 'project_directory_unavailable'
        : error.code === 'workspace_not_found'
          ? 'workspace_not_found'
          : error.code === 'workspace_directory_unavailable'
            ? 'workspace_directory_unavailable'
            : 'workspace_unavailable'
    return { body: errorBody(code, error.message), status: errorStatus(code) }
  }
  console.error('Issue request failed', error)
  return { body: errorBody('internal_error', 'The Issue request failed.'), status: 500 }
}

const workspacePath = async (
  registry: ProjectRegistryApi,
  projectName: string,
  workspaceId: string,
): Promise<string> => {
  const project = await registry.get(projectName)
  if (!project) throw new IssueError('project_not_found', 'Project not found.')
  return (await resolveProjectWorkspace(project, workspaceId)).path
}

export const createIssueRoutes = (registry: ProjectRegistryApi): Hono => {
  const routes = new Hono()

  routes.get('/:projectName/workspaces/:workspaceId/issues', async context => {
    try {
      const path = await workspacePath(
        registry,
        context.req.param('projectName'),
        context.req.param('workspaceId'),
      )
      return context.json(await listIssues(path))
    } catch (error) {
      const result = failure(error)
      return context.json(result.body, result.status)
    }
  })

  routes.get('/:projectName/workspaces/:workspaceId/issues/:issueId', async context => {
    try {
      const path = await workspacePath(
        registry,
        context.req.param('projectName'),
        context.req.param('workspaceId'),
      )
      return context.json(await readIssue(path, context.req.param('issueId')))
    } catch (error) {
      const result = failure(error)
      return context.json(result.body, result.status)
    }
  })

  return routes
}
