import type {
  AgentApiError,
  AgentInputReceipt,
  AgentInputRequest,
  AgentLaunchReceipt,
  AgentLaunchRequest,
  AgentPromptReceipt,
  AgentPromptRequest,
  AgentRuntimeSnapshot,
  AgentStopReceipt,
} from '@herdr-roam/shared'
import {
  AGENT_PROMPT_IMAGE_MAX_BYTES,
  AGENT_PROMPT_IMAGE_MAX_COUNT,
  AGENT_TEXT_MAX_BYTES,
} from '@herdr-roam/shared'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import { SSE_HEARTBEAT_MS } from '../config.js'
import type { ProjectRegistryApi } from '../projects/registry.js'
import { ProjectRegistryError } from '../projects/registry.js'
import { ProjectWorkspaceError } from '../projects/workspaces.js'
import { PromptImageError, readPromptImages } from './images.js'
import { AgentLaunchError } from './launch.js'
import { type AgentPromptInput, type AgentServiceApi, AgentServiceError } from './service.js'

const errorBody = (
  code: AgentApiError['error']['code'],
  message: string,
  recovery?: AgentApiError['error']['recovery'],
): AgentApiError => ({ error: { code, message, ...(recovery ? { recovery } : {}) } })

const snapshotData = (snapshot: AgentRuntimeSnapshot): string => JSON.stringify(snapshot)

const withinTextLimit = (text: string): boolean =>
  Buffer.byteLength(text, 'utf8') <= AGENT_TEXT_MAX_BYTES

const promptRequestSchema: z.ZodType<AgentPromptRequest> = z.object({
  text: z.string().refine(text => text.trim().length > 0 && withinTextLimit(text)),
})

const inputKeySchema = z.enum([
  'up',
  'down',
  'left',
  'right',
  'enter',
  'esc',
  'tab',
  'shift+tab',
  'backspace',
  'delete',
  'home',
  'end',
])

const inputRequestSchema: z.ZodType<AgentInputRequest> = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('keys'),
    keys: z.array(inputKeySchema).min(1).readonly(),
  }),
  z.object({
    type: z.literal('text'),
    text: z.string().min(1).refine(withinTextLimit),
  }),
])

const launchRequestSchema: z.ZodType<AgentLaunchRequest> = z.object({
  projectName: z.string().min(1),
  provider: z.enum(['codex', 'claude']),
  workspaceId: z.string().min(1).optional(),
  prompt: z
    .string()
    .refine(text => text.trim().length > 0 && withinTextLimit(text))
    .optional(),
})

const serviceErrorStatus = (error: AgentServiceError): 404 | 409 | 503 =>
  error.code === 'agent_not_found' ? 404 : error.code === 'runtime_unavailable' ? 503 : 409

const promptInput = async (request: Request): Promise<AgentPromptInput> => {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.startsWith('multipart/form-data')) {
    const parsed = promptRequestSchema.safeParse(await request.json())
    if (!parsed.success) throw new SyntaxError('Invalid Prompt payload.')
    return { text: parsed.data.text, images: [] }
  }

  const form = await request.formData()
  const text = form.get('text')
  const entries = form.getAll('images')
  if (typeof text !== 'string' || entries.some(entry => typeof entry === 'string')) {
    throw new SyntaxError('Invalid multipart Prompt payload.')
  }
  const images = await readPromptImages(
    entries.filter((entry): entry is File => entry instanceof File),
  )
  if ((!text.trim() && images.length === 0) || !withinTextLimit(text)) {
    throw new SyntaxError('Prompt content is invalid.')
  }
  return { text, images }
}

export const createAgentRoutes = (service: AgentServiceApi, projects: ProjectRegistryApi): Hono => {
  const routes = new Hono()

  routes.get('/', context => context.json(service.snapshot()))

  routes.post(
    '/',
    bodyLimit({
      maxSize: AGENT_TEXT_MAX_BYTES + 1024,
      onError: context =>
        context.json(errorBody('invalid_agent_launch', 'The initial Prompt is too large.'), 413),
    }),
    async context => {
      let body: unknown
      try {
        body = await context.req.json()
      } catch (error) {
        if (!(error instanceof SyntaxError)) console.error('Agent launch body read failed', error)
        return context.json(
          errorBody('invalid_agent_launch', 'A Project and supported provider are required.'),
          400,
        )
      }
      const parsed = launchRequestSchema.safeParse(body)
      if (!parsed.success) {
        return context.json(
          errorBody('invalid_agent_launch', 'Invalid Project, provider, directory, or Prompt.'),
          400,
        )
      }
      try {
        const project = await projects.get(parsed.data.projectName)
        if (!project) {
          return context.json(
            errorBody('project_not_found', `Project ${parsed.data.projectName} is not registered.`),
            404,
          )
        }
        const receipt: AgentLaunchReceipt = await service.launch(
          project,
          parsed.data.provider,
          parsed.data.prompt,
          parsed.data.workspaceId ?? 'primary',
        )
        return context.json(receipt, 201)
      } catch (error) {
        if (error instanceof ProjectWorkspaceError) {
          const unavailable = error.code === 'workspace_unavailable'
          return context.json(
            errorBody(
              unavailable ? 'agent_launch_unavailable' : 'project_directory_unavailable',
              error.message,
            ),
            unavailable ? 503 : 409,
          )
        }
        if (error instanceof AgentLaunchError) {
          const status =
            error.code === 'project_directory_unavailable'
              ? 409
              : error.code === 'agent_start_timeout'
                ? 504
                : 502
          return context.json(
            errorBody(error.code, error.message, error.recovery ?? undefined),
            status,
          )
        }
        if (error instanceof AgentServiceError) {
          return context.json(errorBody(error.code, error.message), serviceErrorStatus(error))
        }
        if (error instanceof ProjectRegistryError) {
          return context.json(errorBody('agent_launch_unavailable', error.message), 503)
        }
        console.error('Agent launch failed', error)
        return context.json(errorBody('internal_error', 'The Agent could not be started.'), 500)
      }
    },
  )

  routes.get('/events', context =>
    streamSSE(context, async stream => {
      let finished = false
      const writeSnapshot = async (snapshot: AgentRuntimeSnapshot) => {
        if (finished) return
        try {
          await stream.writeSSE({ event: 'snapshot', data: snapshotData(snapshot) })
        } catch (error) {
          console.error('Agent SSE write failed', error)
        }
      }
      await writeSnapshot(service.snapshot())
      const unsubscribe = service.subscribe(snapshot => void writeSnapshot(snapshot))
      const heartbeat = setInterval(() => {
        void stream.writeSSE({ event: 'heartbeat', data: '' }).catch(error => {
          console.error('Agent SSE heartbeat failed', error)
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
    }),
  )

  routes.get('/:agentId/output', async context => {
    const agentId = context.req.param('agentId')
    try {
      return context.json({ agentId, ...(await service.output(agentId)) })
    } catch (error) {
      if (error instanceof AgentServiceError) {
        const status =
          error.code === 'agent_not_found' ? 404 : error.code === 'runtime_unavailable' ? 503 : 409
        return context.json(errorBody(error.code, error.message), status)
      }
      console.error('Agent output request failed', error)
      return context.json(errorBody('internal_error', 'Recent output could not be read.'), 500)
    }
  })

  routes.post('/:agentId/focus', async context => {
    const agentId = context.req.param('agentId')
    try {
      await service.focus(agentId)
      const receipt: AgentPromptReceipt = { agentId }
      return context.json(receipt)
    } catch (error) {
      if (error instanceof AgentServiceError) {
        return context.json(errorBody(error.code, error.message), serviceErrorStatus(error))
      }
      console.error('Agent focus failed', error)
      return context.json(errorBody('internal_error', 'The Agent could not be focused.'), 500)
    }
  })

  routes.delete('/:agentId', async context => {
    const agentId = context.req.param('agentId')
    try {
      await service.stopAgent(agentId)
      const receipt: AgentStopReceipt = { agentId }
      return context.json(receipt)
    } catch (error) {
      if (error instanceof AgentServiceError) {
        return context.json(errorBody(error.code, error.message), serviceErrorStatus(error))
      }
      console.error('Agent stop failed', error)
      return context.json(errorBody('internal_error', 'The Agent could not be stopped.'), 500)
    }
  })

  routes.post(
    '/:agentId/prompts',
    bodyLimit({
      maxSize: AGENT_PROMPT_IMAGE_MAX_BYTES * AGENT_PROMPT_IMAGE_MAX_COUNT + 1024 * 1024,
      onError: context =>
        context.json(errorBody('invalid_prompt_image', 'The Prompt images are too large.'), 413),
    }),
    async context => {
      let input: AgentPromptInput
      try {
        input = await promptInput(context.req.raw)
      } catch (error) {
        if (error instanceof PromptImageError) {
          return context.json(errorBody('invalid_prompt_image', error.message), 400)
        }
        if (!(error instanceof SyntaxError)) console.error('Agent Prompt body read failed', error)
        return context.json(errorBody('invalid_prompt', 'Prompt text or images are required.'), 400)
      }
      const agentId = context.req.param('agentId')
      try {
        await service.prompt(agentId, input)
        const receipt: AgentPromptReceipt = { agentId }
        return context.json(receipt, 202)
      } catch (error) {
        if (error instanceof AgentServiceError) {
          return context.json(errorBody(error.code, error.message), serviceErrorStatus(error))
        }
        console.error('Agent Prompt request failed', error)
        return context.json(errorBody('internal_error', 'The Prompt could not be sent.'), 500)
      }
    },
  )

  routes.post(
    '/:agentId/input',
    bodyLimit({
      maxSize: AGENT_TEXT_MAX_BYTES + 1024,
      onError: context =>
        context.json(errorBody('invalid_agent_input', 'The Agent input is too large.'), 413),
    }),
    async context => {
      let body: unknown
      try {
        body = await context.req.json()
      } catch (error) {
        if (!(error instanceof SyntaxError)) console.error('Agent input body read failed', error)
        return context.json(errorBody('invalid_agent_input', 'Valid Agent input is required.'), 400)
      }
      const parsed = inputRequestSchema.safeParse(body)
      if (!parsed.success) {
        return context.json(errorBody('invalid_agent_input', 'Valid Agent input is required.'), 400)
      }
      const agentId = context.req.param('agentId')
      try {
        await service.input(agentId, parsed.data)
        const receipt: AgentInputReceipt = { agentId }
        return context.json(receipt, 202)
      } catch (error) {
        if (error instanceof AgentServiceError) {
          return context.json(errorBody(error.code, error.message), serviceErrorStatus(error))
        }
        console.error('Agent input request failed', error)
        return context.json(errorBody('internal_error', 'The Agent input could not be sent.'), 500)
      }
    },
  )

  return routes
}
