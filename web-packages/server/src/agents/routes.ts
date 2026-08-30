import type {
  AgentApiError,
  AgentPromptReceipt,
  AgentPromptRequest,
  AgentRuntimeSnapshot,
} from '@herdr-roam/shared'
import { Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import { SSE_HEARTBEAT_MS } from '../config.js'
import { AgentServiceError, type AgentServiceApi } from './service.js'

const errorBody = (code: AgentApiError['error']['code'], message: string): AgentApiError => ({
  error: { code, message },
})

const snapshotData = (snapshot: AgentRuntimeSnapshot): string => JSON.stringify(snapshot)

const promptRequestSchema: z.ZodType<AgentPromptRequest> = z.object({
  text: z.string().refine(text => text.trim().length > 0),
})

const serviceErrorStatus = (error: AgentServiceError): 404 | 409 | 503 =>
  error.code === 'agent_not_found'
    ? 404
    : error.code === 'runtime_unavailable'
      ? 503
      : 409

export const createAgentRoutes = (service: AgentServiceApi): Hono => {
  const routes = new Hono()

  routes.get('/', context => context.json(service.snapshot()))

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
      return context.json({ agentId, text: await service.output(agentId) })
    } catch (error) {
      if (error instanceof AgentServiceError) {
        const status =
          error.code === 'agent_not_found'
            ? 404
            : error.code === 'runtime_unavailable'
              ? 503
              : 409
        return context.json(errorBody(error.code, error.message), status)
      }
      console.error('Agent output request failed', error)
      return context.json(errorBody('internal_error', 'Recent output could not be read.'), 500)
    }
  })

  routes.post('/:agentId/prompts', async context => {
    let body: unknown
    try {
      body = await context.req.json()
    } catch (error) {
      if (!(error instanceof SyntaxError)) console.error('Agent Prompt body read failed', error)
      return context.json(errorBody('invalid_prompt', 'Prompt text is required.'), 400)
    }
    const parsed = promptRequestSchema.safeParse(body)
    if (!parsed.success) {
      return context.json(errorBody('invalid_prompt', 'Prompt text is required.'), 400)
    }
    const agentId = context.req.param('agentId')
    try {
      await service.prompt(agentId, parsed.data.text)
      const receipt: AgentPromptReceipt = { agentId }
      return context.json(receipt, 202)
    } catch (error) {
      if (error instanceof AgentServiceError) {
        return context.json(errorBody(error.code, error.message), serviceErrorStatus(error))
      }
      console.error('Agent Prompt request failed', error)
      return context.json(errorBody('internal_error', 'The Prompt could not be sent.'), 500)
    }
  })

  return routes
}
