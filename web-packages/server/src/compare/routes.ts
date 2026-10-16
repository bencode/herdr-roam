import type { CompareApiError, Project } from '@herdr-roam/shared'
import { Hono } from 'hono'
import { z } from 'zod'
import { type ProjectRegistryApi, ProjectRegistryError } from '../projects/registry.js'
import { CompareError } from './git.js'
import { createComparison, listCompareBranches, readComparisonFile } from './service.js'

const ref = z.string().min(1).max(1_024)
const compareQuery = z.object({ sourceRef: ref, targetRef: ref })
const fileQuery = z.object({
  baseOid: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
  sourceOid: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
  path: z.string().min(1).max(8_192),
})
type Code = CompareApiError['error']['code']
const statusOf = (code: Code): 400 | 404 | 409 | 413 | 500 | 504 => {
  if (code === 'invalid_query') return 400
  if (code === 'project_not_found' || code === 'file_not_found' || code === 'ref_not_found')
    return 404
  if (code === 'repository_unavailable' || code === 'no_merge_base') return 409
  if (code === 'comparison_too_large') return 413
  if (code === 'git_timeout') return 504
  return 500
}

export const createCompareRoutes = (registry: ProjectRegistryApi): Hono => {
  const routes = new Hono()
  routes.use('*', async (context, next) => {
    context.header('Cache-Control', 'no-store')
    await next()
  })
  routes.onError((error, context) => {
    if (context.req.raw.signal.aborted) return new Response(null, { status: 499 })
    if (error instanceof CompareError)
      return context.json(
        { error: { code: error.code, message: error.message } } satisfies CompareApiError,
        statusOf(error.code),
      )
    if (error instanceof ProjectRegistryError && error.code === 'project_not_found')
      return context.json(
        { error: { code: 'project_not_found', message: error.message } } satisfies CompareApiError,
        404,
      )
    console.error('Project comparison failed', error)
    return context.json(
      {
        error: {
          code: 'internal_error',
          message: 'The comparison could not be loaded. Try again.',
        },
      } satisfies CompareApiError,
      500,
    )
  })
  const projectOf = async (name: string): Promise<Project> => {
    const project = await registry.get(name)
    if (!project) throw new CompareError('project_not_found', 'Project not found.')
    return project
  }
  routes.get('/:projectName/branches', async context =>
    context.json(
      await listCompareBranches(
        await projectOf(context.req.param('projectName')),
        context.req.raw.signal,
      ),
    ),
  )
  routes.get('/:projectName/compare', async context => {
    const query = compareQuery.safeParse(context.req.query())
    if (!query.success)
      throw new CompareError('invalid_query', 'Choose a source and target branch.')
    return context.json(
      await createComparison(
        await projectOf(context.req.param('projectName')),
        query.data.sourceRef,
        query.data.targetRef,
        context.req.raw.signal,
      ),
    )
  })
  routes.get('/:projectName/compare/file', async context => {
    const query = fileQuery.safeParse(context.req.query())
    if (!query.success)
      throw new CompareError('invalid_query', 'Commit OIDs and a changed file path are required.')
    return context.json(
      await readComparisonFile(
        await projectOf(context.req.param('projectName')),
        query.data.baseOid,
        query.data.sourceOid,
        query.data.path,
        context.req.raw.signal,
      ),
    )
  })
  return routes
}
