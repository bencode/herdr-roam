import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import type { ProjectFileApiError } from '@herdr-roam/shared'
import { Hono } from 'hono'
import { z } from 'zod'
import type { ProjectRegistryApi } from '../projects/registry.js'
import { ProjectRegistryError } from '../projects/registry.js'
import { listProjectDirectory, searchProjectFiles } from './catalog.js'
import { readProjectFile, readRawProjectFile } from './content.js'
import { ProjectFileError } from './path.js'

const pageQuerySchema = z.object({
  directory: z.string().max(4_096).optional(),
  cursor: z.string().min(1).max(8_192).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
})
const searchQuerySchema = z.object({
  query: z.string().trim().min(1).max(500),
  cursor: z.string().min(1).max(8_192).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
})
const viewQuerySchema = z.object({ path: z.string().min(1).max(8_192) })

type ErrorCode = ProjectFileApiError['error']['code']

const errorBody = (code: ErrorCode, message: string): ProjectFileApiError => ({
  error: { code, message },
})

const errorStatus = (code: ErrorCode): 400 | 404 | 409 | 413 | 415 | 500 => {
  if (code === 'invalid_path' || code === 'invalid_cursor') return 400
  if (code === 'project_not_found' || code === 'file_not_found') return 404
  if (code === 'project_directory_unavailable' || code === 'file_unavailable') return 409
  if (code === 'catalog_too_large') return 413
  if (code === 'file_unsupported') return 415
  return 500
}

const failure = (
  error: unknown,
): { readonly body: ProjectFileApiError; readonly status: ReturnType<typeof errorStatus> } => {
  if (error instanceof ProjectFileError) {
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
  console.error('Project file request failed', error)
  return {
    body: errorBody('internal_error', 'The Project file request failed.'),
    status: 500,
  }
}

const projectPath = async (registry: ProjectRegistryApi, name: string): Promise<string> => {
  const project = await registry.get(name)
  if (!project) throw new ProjectFileError('project_not_found', 'Project not found.')
  return project.path
}

export const createFileRoutes = (registry: ProjectRegistryApi): Hono => {
  const routes = new Hono()

  routes.get('/:projectName/files', async context => {
    const query = pageQuerySchema.safeParse(context.req.query())
    if (!query.success) {
      return context.json(errorBody('invalid_path', 'Invalid file catalog query.'), 400)
    }
    try {
      const path = await projectPath(registry, context.req.param('projectName'))
      return context.json(await listProjectDirectory(path, query.data))
    } catch (error) {
      const result = failure(error)
      return context.json(result.body, result.status)
    }
  })

  routes.get('/:projectName/files/search', async context => {
    const query = searchQuerySchema.safeParse(context.req.query())
    if (!query.success) {
      return context.json(errorBody('invalid_path', 'A valid file search query is required.'), 400)
    }
    try {
      const path = await projectPath(registry, context.req.param('projectName'))
      return context.json(await searchProjectFiles(path, query.data))
    } catch (error) {
      const result = failure(error)
      return context.json(result.body, result.status)
    }
  })

  routes.get('/:projectName/files/view', async context => {
    const query = viewQuerySchema.safeParse(context.req.query())
    if (!query.success) {
      return context.json(errorBody('invalid_path', 'A valid file path is required.'), 400)
    }
    try {
      const path = await projectPath(registry, context.req.param('projectName'))
      return context.json(await readProjectFile(path, query.data.path))
    } catch (error) {
      const result = failure(error)
      return context.json(result.body, result.status)
    }
  })

  routes.get('/:projectName/files/raw/:path{.+}', async context => {
    const requestedPath = context.req.param('path')
    if (!requestedPath)
      return context.json(errorBody('invalid_path', 'A valid file path is required.'), 400)
    try {
      const path = await projectPath(registry, context.req.param('projectName'))
      const asset = await readRawProjectFile(path, requestedPath)
      const headers = new Headers({
        'Cache-Control': 'no-store',
        'Content-Length': String(asset.size),
        'Content-Type': asset.mediaType,
        'X-Content-Type-Options': 'nosniff',
      })
      if (asset.svg) {
        headers.set(
          'Content-Security-Policy',
          "sandbox; default-src 'none'; style-src 'unsafe-inline'",
        )
      }
      return new Response(Readable.toWeb(createReadStream(asset.path)) as ReadableStream, {
        headers,
      })
    } catch (error) {
      const result = failure(error)
      return context.json(result.body, result.status)
    }
  })

  return routes
}
