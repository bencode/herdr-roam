import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import type { SkillApiError, SkillScope, SkillSource } from '@herdr-roam/shared'
import { Hono } from 'hono'
import { z } from 'zod'
import { personalSkillRoots } from '../config.js'
import { ProjectFileError } from '../files/path.js'
import type { ProjectRegistryApi } from '../projects/registry.js'
import { ProjectRegistryError } from '../projects/registry.js'
import { listSkills, readSkillDetail, resolveSkill } from './catalog.js'
import { listSkillDirectory, readRawSkillFile, readSkillFile } from './content.js'
import { personalRoots, projectRoots, SkillError, type SkillRoot } from './identity.js'

const catalogQuerySchema = z.object({ project: z.string().min(1).max(64).optional() })
const resourceQuerySchema = z.object({ project: z.string().min(1).max(64).optional() })
const pageQuerySchema = resourceQuerySchema.extend({
  directory: z.string().max(4_096).optional(),
  cursor: z.string().min(1).max(8_192).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
})
const viewQuerySchema = resourceQuerySchema.extend({ path: z.string().min(1).max(8_192) })
const scopeSchema = z.enum(['user', 'project'])

type ErrorCode = SkillApiError['error']['code']

const errorBody = (code: ErrorCode, message: string): SkillApiError => ({
  error: { code, message },
})

const errorStatus = (code: ErrorCode): 400 | 404 | 409 | 415 | 500 => {
  if (code === 'invalid_skill' || code === 'invalid_path' || code === 'invalid_cursor') return 400
  if (code === 'skill_not_found' || code === 'project_not_found' || code === 'file_not_found') {
    return 404
  }
  if (
    code === 'skill_unavailable' ||
    code === 'project_directory_unavailable' ||
    code === 'file_unavailable'
  ) {
    return 409
  }
  if (code === 'file_unsupported') return 415
  return 500
}

const fileErrorCode = (error: ProjectFileError): ErrorCode =>
  error.code === 'catalog_too_large' ? 'file_unavailable' : error.code

const failure = (
  error: unknown,
): { readonly body: SkillApiError; readonly status: ReturnType<typeof errorStatus> } => {
  if (error instanceof SkillError) {
    return { body: errorBody(error.code, error.message), status: errorStatus(error.code) }
  }
  if (error instanceof ProjectFileError) {
    const code = fileErrorCode(error)
    return { body: errorBody(code, error.message), status: errorStatus(code) }
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
  console.error('Skill request failed', error)
  return { body: errorBody('internal_error', 'The Skill request failed.'), status: 500 }
}

const registeredProject = async (registry: ProjectRegistryApi, name: string) => {
  const project = await registry.get(name)
  if (!project) throw new SkillError('project_not_found', 'Project not found.')
  return project
}

const rootsForScope = async (
  registry: ProjectRegistryApi,
  userRoots: Readonly<Record<SkillSource, string>>,
  scope: SkillScope,
  projectName: string | undefined,
): Promise<readonly SkillRoot[]> => {
  if (scope === 'user') return personalRoots(userRoots)
  if (!projectName) {
    throw new SkillError('invalid_skill', 'A Project name is required for a Project Skill.')
  }
  const project = await registeredProject(registry, projectName)
  return projectRoots(project.name, project.path)
}

const resourceRequest = async <Value>(
  registry: ProjectRegistryApi,
  userRoots: Readonly<Record<SkillSource, string>>,
  scopeValue: string,
  projectName: string | undefined,
  operation: (roots: readonly SkillRoot[]) => Promise<Value>,
): Promise<Value> => {
  const scope = scopeSchema.safeParse(scopeValue)
  if (!scope.success) throw new SkillError('invalid_skill', 'Skill scope is invalid.')
  return operation(await rootsForScope(registry, userRoots, scope.data, projectName))
}

export const createSkillRoutes = (
  registry: ProjectRegistryApi,
  userRoots: Readonly<Record<SkillSource, string>> = personalSkillRoots,
): Hono => {
  const routes = new Hono()

  routes.get('/', async context => {
    const query = catalogQuerySchema.safeParse(context.req.query())
    if (!query.success)
      return context.json(errorBody('invalid_skill', 'Invalid catalog query.'), 400)
    try {
      const roots = [...personalRoots(userRoots)]
      if (query.data.project) {
        const project = await registeredProject(registry, query.data.project)
        roots.push(...projectRoots(project.name, project.path))
      }
      return context.json(await listSkills(roots))
    } catch (error) {
      const result = failure(error)
      return context.json(result.body, result.status)
    }
  })

  routes.get('/:scope/:skillId/files/view', async context => {
    const query = viewQuerySchema.safeParse(context.req.query())
    if (!query.success)
      return context.json(errorBody('invalid_path', 'A valid file path is required.'), 400)
    try {
      const value = await resourceRequest(
        registry,
        userRoots,
        context.req.param('scope'),
        query.data.project,
        async roots => {
          const skill = await resolveSkill(roots, context.req.param('skillId'))
          return readSkillFile(skill.root, query.data.path)
        },
      )
      return context.json(value)
    } catch (error) {
      const result = failure(error)
      return context.json(result.body, result.status)
    }
  })

  routes.get('/:scope/:skillId/files/raw/:path{.+}', async context => {
    const query = resourceQuerySchema.safeParse(context.req.query())
    const requestedPath = context.req.param('path')
    if (!query.success || !requestedPath) {
      return context.json(errorBody('invalid_path', 'A valid file path is required.'), 400)
    }
    try {
      const asset = await resourceRequest(
        registry,
        userRoots,
        context.req.param('scope'),
        query.data.project,
        async roots => {
          const skill = await resolveSkill(roots, context.req.param('skillId'))
          return readRawSkillFile(skill.root, requestedPath)
        },
      )
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

  routes.get('/:scope/:skillId/files', async context => {
    const query = pageQuerySchema.safeParse(context.req.query())
    if (!query.success)
      return context.json(errorBody('invalid_path', 'Invalid file catalog query.'), 400)
    try {
      const value = await resourceRequest(
        registry,
        userRoots,
        context.req.param('scope'),
        query.data.project,
        async roots => {
          const skill = await resolveSkill(roots, context.req.param('skillId'))
          return listSkillDirectory(skill.root, query.data)
        },
      )
      return context.json(value)
    } catch (error) {
      const result = failure(error)
      return context.json(result.body, result.status)
    }
  })

  routes.get('/:scope/:skillId', async context => {
    const query = resourceQuerySchema.safeParse(context.req.query())
    if (!query.success) return context.json(errorBody('invalid_skill', 'Invalid Skill query.'), 400)
    try {
      const value = await resourceRequest(
        registry,
        userRoots,
        context.req.param('scope'),
        query.data.project,
        roots => readSkillDetail(roots, context.req.param('skillId')),
      )
      return context.json(value)
    } catch (error) {
      const result = failure(error)
      return context.json(result.body, result.status)
    }
  })

  return routes
}
