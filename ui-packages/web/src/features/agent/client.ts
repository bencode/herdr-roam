import type {
  AgentApiError,
  AgentInputReceipt,
  AgentInputRequest,
  AgentLaunchReceipt,
  AgentLaunchRecovery,
  AgentLaunchRequest,
  AgentOutput,
  AgentPromptReceipt,
  AgentRuntimeSnapshot,
  AgentStopReceipt,
} from '@herdr-roam/shared'
import { z } from 'zod'

const agentStatusSchema = z.enum(['blocked', 'working', 'idle', 'done', 'unknown'])

const agentSessionSchema = z.object({
  source: z.string().min(1),
  agent: z.string().min(1),
  kind: z.enum(['id', 'path']),
  value: z.string().min(1),
})

const agentSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  provider: z.string().min(1).nullable(),
  status: agentStatusSchema,
  cwd: z.string().min(1).nullable(),
  attachTarget: z.string().min(1),
  session: agentSessionSchema.nullable(),
})

const agentRuntimeSnapshotSchema = z.object({
  source: z.discriminatedUnion('state', [
    z.object({
      state: z.literal('connected'),
      version: z.string().min(1),
      protocol: z.number().int().nonnegative(),
    }),
    z.object({
      state: z.enum(['reconnecting', 'unavailable']),
      code: z.enum([
        'herdr_missing',
        'herdr_not_running',
        'protocol_incompatible',
        'herdr_unavailable',
      ]),
      message: z.string().min(1),
    }),
  ]),
  stale: z.boolean(),
  items: z.array(agentSummarySchema).readonly(),
})

const agentOutputSchema = z.object({
  agentId: z.string().min(1),
  text: z.string(),
  truncated: z.boolean(),
})

const agentReceiptSchema = z.object({
  agentId: z.string().min(1),
})

const agentLaunchRecoverySchema = z.object({
  phase: z.enum(['agent_start', 'agent_ready', 'initial_prompt']),
  workspaceId: z.string().min(1),
  paneId: z.string().min(1),
  terminalId: z.string().min(1),
  agentId: z.string().min(1).optional(),
  attachCommand: z.string().min(1),
})

const agentLaunchReceiptSchema = z.object({
  agent: agentSummarySchema,
  workspaceId: z.string().min(1),
  paneId: z.string().min(1),
})

const agentApiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      'agent_not_found',
      'runtime_unavailable',
      'agent_output_unavailable',
      'invalid_prompt',
      'agent_not_ready',
      'agent_prompt_unavailable',
      'invalid_agent_input',
      'agent_input_unavailable',
      'invalid_prompt_image',
      'agent_focus_unavailable',
      'agent_stop_unavailable',
      'invalid_agent_launch',
      'project_not_found',
      'project_directory_unavailable',
      'agent_launch_unavailable',
      'agent_start_timeout',
      'agent_kind_mismatch',
      'internal_error',
    ]),
    message: z.string().min(1),
    recovery: agentLaunchRecoverySchema.optional(),
  }),
})

export class AgentClientError extends Error {
  readonly code: AgentApiError['error']['code'] | 'invalid_response' | 'network_error'
  readonly recovery: AgentLaunchRecovery | null

  constructor(
    code: AgentClientError['code'],
    message: string,
    recovery: AgentLaunchRecovery | null = null,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'AgentClientError'
    this.code = code
    this.recovery = recovery
  }
}

const responseJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json()
  } catch (error) {
    throw new AgentClientError('invalid_response', 'The server returned invalid JSON.', null, {
      cause: error,
    })
  }
}

const parsedResponse = async <Value>(
  response: Response,
  parse: (value: unknown) => Value,
): Promise<Value> => {
  const body = await responseJson(response)
  if (!response.ok) {
    const apiError = agentApiErrorSchema.safeParse(body)
    if (apiError.success) {
      throw new AgentClientError(
        apiError.data.error.code,
        apiError.data.error.message,
        apiError.data.error.recovery ?? null,
      )
    }
    throw new AgentClientError('invalid_response', `The server returned HTTP ${response.status}.`)
  }
  try {
    return parse(body)
  } catch (error) {
    throw new AgentClientError(
      'invalid_response',
      'The server returned an invalid Agent payload.',
      null,
      {
        cause: error,
      },
    )
  }
}

export const fetchAgentSnapshot = async (): Promise<AgentRuntimeSnapshot> => {
  try {
    return await parsedResponse(await fetch('/api/agents'), agentRuntimeSnapshotSchema.parse)
  } catch (error) {
    if (error instanceof AgentClientError) throw error
    throw new AgentClientError('network_error', 'Herdr Roam could not be reached.', null, {
      cause: error,
    })
  }
}

export const fetchAgentOutput = async (agentId: string): Promise<AgentOutput> => {
  try {
    return await parsedResponse(
      await fetch(`/api/agents/${encodeURIComponent(agentId)}/output`),
      agentOutputSchema.parse,
    )
  } catch (error) {
    if (error instanceof AgentClientError) throw error
    throw new AgentClientError('network_error', 'Recent output could not be requested.', null, {
      cause: error,
    })
  }
}

export const submitAgentPrompt = async (
  agentId: string,
  text: string,
  images: readonly File[] = [],
): Promise<AgentPromptReceipt> => {
  const request =
    images.length === 0
      ? {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text }),
        }
      : (() => {
          const form = new FormData()
          form.set('text', text)
          images.forEach(image => {
            form.append('images', image)
          })
          return { method: 'POST', body: form }
        })()
  try {
    return await parsedResponse(
      await fetch(`/api/agents/${encodeURIComponent(agentId)}/prompts`, request),
      agentReceiptSchema.parse,
    )
  } catch (error) {
    if (error instanceof AgentClientError) throw error
    throw new AgentClientError('network_error', 'The Prompt could not be submitted.', null, {
      cause: error,
    })
  }
}

export const sendAgentInput = async (
  agentId: string,
  input: AgentInputRequest,
): Promise<AgentInputReceipt> => {
  try {
    return await parsedResponse(
      await fetch(`/api/agents/${encodeURIComponent(agentId)}/input`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      }),
      agentReceiptSchema.parse,
    )
  } catch (error) {
    if (error instanceof AgentClientError) throw error
    throw new AgentClientError('network_error', 'The Agent input could not be sent.', null, {
      cause: error,
    })
  }
}

export const launchProjectAgent = async (
  request: AgentLaunchRequest,
): Promise<AgentLaunchReceipt> => {
  try {
    return await parsedResponse(
      await fetch('/api/agents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      }),
      agentLaunchReceiptSchema.parse,
    )
  } catch (error) {
    if (error instanceof AgentClientError) throw error
    throw new AgentClientError('network_error', 'The Agent could not be started.', null, {
      cause: error,
    })
  }
}

export const focusAgentInHerdr = async (agentId: string): Promise<AgentPromptReceipt> => {
  try {
    return await parsedResponse(
      await fetch(`/api/agents/${encodeURIComponent(agentId)}/focus`, { method: 'POST' }),
      agentReceiptSchema.parse,
    )
  } catch (error) {
    if (error instanceof AgentClientError) throw error
    throw new AgentClientError('network_error', 'The Agent could not be focused.', null, {
      cause: error,
    })
  }
}

export const stopAgent = async (agentId: string): Promise<AgentStopReceipt> => {
  try {
    return await parsedResponse(
      await fetch(`/api/agents/${encodeURIComponent(agentId)}`, { method: 'DELETE' }),
      agentReceiptSchema.parse,
    )
  } catch (error) {
    if (error instanceof AgentClientError) throw error
    throw new AgentClientError('network_error', 'The Agent could not be stopped.', null, {
      cause: error,
    })
  }
}

export const subscribeAgentSnapshots = (
  onSnapshot: (snapshot: AgentRuntimeSnapshot) => void,
  onError: (error: AgentClientError) => void,
): (() => void) => {
  const source = new EventSource('/api/agents/events')
  source.addEventListener('snapshot', event => {
    try {
      onSnapshot(agentRuntimeSnapshotSchema.parse(JSON.parse(event.data)))
    } catch (error) {
      onError(
        new AgentClientError(
          'invalid_response',
          'The Agent event stream returned invalid data.',
          null,
          {
            cause: error,
          },
        ),
      )
    }
  })
  source.addEventListener('error', () => {
    onError(new AgentClientError('network_error', 'The Agent event stream is reconnecting.'))
  })
  return () => source.close()
}
