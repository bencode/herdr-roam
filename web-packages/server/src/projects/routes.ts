import type {
  ProjectApiError,
  ProjectCreateReceipt,
  ProjectCreateRequest,
} from '@herdr-roam/shared'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  ProjectRegistryError,
  type ProjectRegistryApi,
} from './registry.js'

const createRequestSchema: z.ZodType<ProjectCreateRequest> = z.object({
  name: z.string(),
  path: z.string(),
})

const errorBody = (
  code: ProjectApiError['error']['code'],
  message: string,
  configPath?: string,
): ProjectApiError => ({ error: { code, message, ...(configPath ? { configPath } : {}) } })

const registryErrorStatus = (error: ProjectRegistryError): 400 | 409 | 500 =>
  error.code === 'invalid_project' || error.code === 'project_directory_unavailable'
    ? 400
    : error.code === 'project_name_taken' || error.code === 'project_path_taken'
      ? 409
      : 500

export const createProjectRoutes = (registry: ProjectRegistryApi): Hono => {
  const routes = new Hono()

  routes.get('/', async context => {
    try {
      return context.json(await registry.snapshot())
    } catch (error) {
      if (error instanceof ProjectRegistryError) {
        return context.json(
          errorBody(error.code, error.message, error.configPath),
          registryErrorStatus(error),
        )
      }
      console.error('Project registry read failed', error)
      return context.json(errorBody('internal_error', 'Projects could not be loaded.'), 500)
    }
  })

  routes.post('/', async context => {
    let body: unknown
    try {
      body = await context.req.json()
    } catch (error) {
      if (!(error instanceof SyntaxError)) console.error('Project request body read failed', error)
      return context.json(errorBody('invalid_project', 'Project name and path are required.'), 400)
    }
    const parsed = createRequestSchema.safeParse(body)
    if (!parsed.success) {
      return context.json(errorBody('invalid_project', 'Project name and path are required.'), 400)
    }
    try {
      const project = await registry.add(parsed.data)
      const snapshot = await registry.snapshot()
      const response: ProjectCreateReceipt = { ...snapshot, project }
      return context.json(response, 201)
    } catch (error) {
      if (error instanceof ProjectRegistryError) {
        return context.json(
          errorBody(error.code, error.message, error.configPath),
          registryErrorStatus(error),
        )
      }
      console.error('Project registration failed', error)
      return context.json(errorBody('internal_error', 'Project could not be registered.'), 500)
    }
  })

  return routes
}
