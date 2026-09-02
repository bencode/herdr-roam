import type { SessionApiError } from '@herdr-roam/shared'
import { Hono } from 'hono'
import { z } from 'zod'
import { AgentLaunchError } from '../agents/launch.js'
import { type AgentServiceApi, AgentServiceError } from '../agents/service.js'
import type { ProjectRegistryApi } from '../projects/registry.js'
import { ProjectRegistryError } from '../projects/registry.js'
import { type SessionServiceApi, SessionServiceError } from './service.js'

type ErrorCode = SessionApiError['error']['code']

const errorBody = (
  code: ErrorCode,
  message: string,
  recovery?: SessionApiError['error']['recovery'],
): SessionApiError => ({ error: { code, message, ...(recovery ? { recovery } : {}) } })

const providerSchema = z.enum(['codex', 'claude'])
const catalogQuerySchema = z.object({
  cursor: z.string().min(1).max(4_096).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  query: z.string().max(200).optional(),
})
const historyQuerySchema = z
  .object({
    before: z.string().min(1).max(4_096).optional(),
    after: z.string().min(1).max(4_096).optional(),
  })
  .refine(value => !(value.before && value.after))

const projectOrResponse = async (
  projects: ProjectRegistryApi,
  projectName: string,
): Promise<Awaited<ReturnType<ProjectRegistryApi['get']>>> => projects.get(projectName)

const historyFailure = (error: unknown): SessionApiError => {
  if (error instanceof SessionServiceError) {
    return errorBody(
      error.code === 'history_changed'
        ? 'session_history_changed'
        : error.code === 'invalid_cursor'
          ? 'invalid_session'
          : 'session_history_unavailable',
      error.message,
    )
  }
  if (error instanceof ProjectRegistryError) {
    return errorBody('session_history_unavailable', error.message)
  }
  console.error('Session history request failed', error)
  return errorBody('internal_error', 'The Session request failed.')
}

const resumeFailure = (error: unknown): SessionApiError => {
  if (error instanceof AgentServiceError && error.code === 'runtime_unavailable') {
    return errorBody('runtime_unavailable', error.message)
  }
  if (error instanceof AgentLaunchError) {
    const code: ErrorCode =
      error.code === 'project_directory_unavailable'
        ? 'session_directory_unavailable'
        : 'session_resume_unavailable'
    return errorBody(code, error.message, error.recovery ?? undefined)
  }
  if (error instanceof SessionServiceError) {
    return errorBody('session_resume_unavailable', error.message)
  }
  console.error('Session resume failed', error)
  return errorBody('internal_error', 'The Session could not be resumed.')
}

export const createSessionRoutes = (
  sessions: SessionServiceApi,
  agents: AgentServiceApi,
  projects: ProjectRegistryApi,
): Hono => {
  const routes = new Hono()

  routes.get('/:projectName/sessions', async context => {
    const query = catalogQuerySchema.safeParse(context.req.query())
    if (!query.success) {
      return context.json(errorBody('invalid_session', 'Invalid Session catalog query.'), 400)
    }
    try {
      const project = await projectOrResponse(projects, context.req.param('projectName'))
      if (!project) return context.json(errorBody('project_not_found', 'Project not found.'), 404)
      return context.json(
        await sessions.list(project, { ...query.data, signal: context.req.raw.signal }),
      )
    } catch (error) {
      const body = historyFailure(error)
      return context.json(body, body.error.code === 'invalid_session' ? 400 : 503)
    }
  })

  routes.get('/:projectName/sessions/:provider/:sessionId', async context => {
    const provider = providerSchema.safeParse(context.req.param('provider'))
    if (!provider.success) {
      return context.json(errorBody('invalid_session', 'Unsupported Session provider.'), 400)
    }
    const query = historyQuerySchema.safeParse(context.req.query())
    if (!query.success) {
      return context.json(errorBody('invalid_session', 'Invalid Session history query.'), 400)
    }
    try {
      const project = await projectOrResponse(projects, context.req.param('projectName'))
      if (!project) return context.json(errorBody('project_not_found', 'Project not found.'), 404)
      const session = query.data.after
        ? await sessions.delta(
            project,
            provider.data,
            context.req.param('sessionId'),
            query.data.after,
          )
        : await sessions.page(
            project,
            provider.data,
            context.req.param('sessionId'),
            query.data.before,
          )
      return session
        ? context.json(session)
        : context.json(errorBody('session_not_found', 'Session not found.'), 404)
    } catch (error) {
      const body = historyFailure(error)
      const status =
        body.error.code === 'invalid_session'
          ? 400
          : body.error.code === 'session_history_changed'
            ? 409
            : 503
      return context.json(body, status)
    }
  })

  routes.post('/:projectName/sessions/:provider/:sessionId/resume', async context => {
    const provider = providerSchema.safeParse(context.req.param('provider'))
    if (!provider.success) {
      return context.json(errorBody('invalid_session', 'Unsupported Session provider.'), 400)
    }
    try {
      const project = await projectOrResponse(projects, context.req.param('projectName'))
      if (!project) return context.json(errorBody('project_not_found', 'Project not found.'), 404)
      const target = await sessions.resumeTarget(
        project,
        provider.data,
        context.req.param('sessionId'),
      )
      if (!target) return context.json(errorBody('session_not_found', 'Session not found.'), 404)
      const receipt = await agents.resume(project, target.session, target.latestCwd)
      return context.json(receipt, receipt.reused ? 200 : 201)
    } catch (error) {
      const body = resumeFailure(error)
      const status =
        body.error.code === 'runtime_unavailable'
          ? 503
          : body.error.code === 'session_directory_unavailable'
            ? 409
            : body.error.code === 'internal_error'
              ? 500
              : 502
      return context.json(body, status)
    }
  })

  return routes
}
