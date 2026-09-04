import type {
  ProjectApiError,
  ProjectCreateRequest,
  ProjectMutationReceipt,
  ProjectRegistrySnapshot,
} from '@herdr-roam/shared'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import { SSE_HEARTBEAT_MS } from '../config.js'
import { ProjectRegistryError, type ProjectRegistryApi } from './registry.js'
import { listProjectWorkspaces, ProjectWorkspaceError } from './workspaces.js'

const createRequestSchema: z.ZodType<ProjectCreateRequest> = z.object({ path: z.string() })

const errorBody = (
  code: ProjectApiError['error']['code'],
  message: string,
  configPath?: string,
): ProjectApiError => ({ error: { code, message, ...(configPath ? { configPath } : {}) } })

const registryErrorStatus = (error: ProjectRegistryError): 400 | 404 | 500 =>
  error.code === 'project_not_found'
    ? 404
    : error.code === 'invalid_project' || error.code === 'project_directory_unavailable'
      ? 400
      : 500

const registryFailure = (error: ProjectRegistryError) => ({
  body: errorBody(error.code, error.message, error.configPath),
  status: registryErrorStatus(error),
})

const snapshotData = (snapshot: ProjectRegistrySnapshot): string => JSON.stringify(snapshot)

export const createProjectRoutes = (registry: ProjectRegistryApi): Hono => {
  const routes = new Hono()

  routes.get('/', async context => {
    try {
      return context.json(await registry.snapshot())
    } catch (error) {
      if (error instanceof ProjectRegistryError) {
        const failure = registryFailure(error)
        return context.json(failure.body, failure.status)
      }
      console.error('Project registry read failed', error)
      return context.json(errorBody('internal_error', 'Projects could not be loaded.'), 500)
    }
  })

  routes.get('/events', async context => {
    let initial: ProjectRegistrySnapshot
    try {
      initial = await registry.snapshot()
    } catch (error) {
      if (error instanceof ProjectRegistryError) {
        const failure = registryFailure(error)
        return context.json(failure.body, failure.status)
      }
      console.error('Project event stream setup failed', error)
      return context.json(errorBody('internal_error', 'Project updates are unavailable.'), 500)
    }
    return streamSSE(context, async stream => {
      let finished = false
      const writeSnapshot = async (snapshot: ProjectRegistrySnapshot) => {
        if (finished) return
        try {
          await stream.writeSSE({ event: 'snapshot', data: snapshotData(snapshot) })
        } catch (error) {
          console.error('Project SSE write failed', error)
        }
      }
      await writeSnapshot(initial)
      const unsubscribe = registry.subscribe(snapshot => void writeSnapshot(snapshot))
      const heartbeat = setInterval(() => {
        void stream.writeSSE({ event: 'heartbeat', data: '' }).catch(error => {
          console.error('Project SSE heartbeat failed', error)
        })
      }, SSE_HEARTBEAT_MS)
      await new Promise<void>(resolve => {
        stream.onAbort(() => {
          finished = true
          clearInterval(heartbeat)
          unsubscribe()
          resolve()
        })
      })
    })
  })

  routes.post('/', async context => {
    let body: unknown
    try {
      body = await context.req.json()
    } catch (error) {
      if (!(error instanceof SyntaxError)) console.error('Project request body read failed', error)
      return context.json(
        errorBody('invalid_project', 'An absolute Project path is required.'),
        400,
      )
    }
    const parsed = createRequestSchema.safeParse(body)
    if (!parsed.success) {
      return context.json(
        errorBody('invalid_project', 'An absolute Project path is required.'),
        400,
      )
    }
    try {
      const project = await registry.add(parsed.data)
      const response: ProjectMutationReceipt = { ...(await registry.snapshot()), project }
      return context.json(response, 201)
    } catch (error) {
      if (error instanceof ProjectRegistryError) {
        const failure = registryFailure(error)
        return context.json(failure.body, failure.status)
      }
      console.error('Project registration failed', error)
      return context.json(errorBody('internal_error', 'Project could not be added.'), 500)
    }
  })

  routes.get('/:projectName/workspaces', async context => {
    try {
      const project = await registry.get(context.req.param('projectName'))
      if (!project) return context.json(errorBody('project_not_found', 'Project not found.'), 404)
      return context.json({ items: await listProjectWorkspaces(project) })
    } catch (error) {
      if (error instanceof ProjectWorkspaceError) {
        const code =
          error.code === 'project_directory_unavailable'
            ? 'project_directory_unavailable'
            : 'workspace_unavailable'
        return context.json(
          errorBody(code, error.message),
          code === 'workspace_unavailable' ? 503 : 409,
        )
      }
      if (error instanceof ProjectRegistryError) {
        const failure = registryFailure(error)
        return context.json(failure.body, failure.status)
      }
      console.error('Project Workspace discovery failed', error)
      return context.json(
        errorBody('internal_error', 'Project Workspaces could not be loaded.'),
        500,
      )
    }
  })

  routes.delete('/:projectName', async context => {
    try {
      const project = await registry.remove(context.req.param('projectName'))
      const response: ProjectMutationReceipt = { ...(await registry.snapshot()), project }
      return context.json(response)
    } catch (error) {
      if (error instanceof ProjectRegistryError) {
        const failure = registryFailure(error)
        return context.json(failure.body, failure.status)
      }
      console.error('Project removal failed', error)
      return context.json(errorBody('internal_error', 'Project could not be removed.'), 500)
    }
  })

  return routes
}
