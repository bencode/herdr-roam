import type {
  AgentLaunchReceipt,
  AgentProvider,
  AgentRuntimeSnapshot,
  AgentSummary,
  Project,
} from '@herdr-roam/shared'
import { HerdrApiError, type HerdrClient } from '../herdr/client.js'
import { launchAgent } from './launch.js'
import { createAgentRuntime, type AgentRuntime } from './runtime.js'

type Listener = (snapshot: AgentRuntimeSnapshot) => void

export type AgentServiceApi = {
  readonly snapshot: () => AgentRuntimeSnapshot
  readonly subscribe: (listener: Listener) => () => void
  readonly output: (agentId: string) => Promise<string>
  readonly prompt: (agentId: string, text: string) => Promise<void>
  readonly focus: (agentId: string) => Promise<void>
  readonly launch: (
    project: Project,
    provider: AgentProvider,
    prompt: string,
  ) => Promise<AgentLaunchReceipt>
}

export type AgentService = AgentServiceApi & {
  readonly start: () => void
  readonly stop: () => void
}

export type AgentServiceErrorCode =
  | 'agent_not_found'
  | 'runtime_unavailable'
  | 'agent_output_unavailable'
  | 'agent_not_ready'
  | 'agent_prompt_unavailable'
  | 'agent_focus_unavailable'

export class AgentServiceError extends Error {
  readonly code: AgentServiceErrorCode

  constructor(code: AgentServiceErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AgentServiceError'
    this.code = code
  }
}

const connectedAgent = (
  runtime: AgentRuntime,
  agentId: string,
): readonly [AgentSummary, HerdrClient] => {
  const snapshot = runtime.snapshot()
  const agent = snapshot.items.find(item => item.id === agentId)
  if (!agent) throw new AgentServiceError('agent_not_found', `Agent ${agentId} was not found.`)
  const client = runtime.client()
  if (!client || snapshot.source.state !== 'connected') {
    throw new AgentServiceError('runtime_unavailable', 'Herdr is not currently connected.')
  }
  return [agent, client]
}

const connectedClient = (runtime: AgentRuntime): HerdrClient => {
  const client = runtime.client()
  if (!client || runtime.snapshot().source.state !== 'connected') {
    throw new AgentServiceError('runtime_unavailable', 'Herdr is not currently connected.')
  }
  return client
}

const promptNotReadyMessage = (status: AgentSummary['status']): string =>
  status === 'blocked'
    ? 'The Agent is blocked and requires direct terminal interaction.'
    : 'The Agent is not ready to accept a Prompt.'

const readOutput = async (runtime: AgentRuntime, agentId: string): Promise<string> => {
  const [agent, client] = connectedAgent(runtime, agentId)
  try {
    return await client.readAgent(agent.attachTarget)
  } catch (error) {
    const message = error instanceof HerdrApiError ? error.message : 'Recent output is unavailable.'
    throw new AgentServiceError('agent_output_unavailable', message, { cause: error })
  }
}

const submitPrompt = async (
  runtime: AgentRuntime,
  agentId: string,
  text: string,
): Promise<void> => {
  const [agent, client] = connectedAgent(runtime, agentId)
  if (agent.status !== 'idle' && agent.status !== 'done' && agent.status !== 'working') {
    throw new AgentServiceError('agent_not_ready', promptNotReadyMessage(agent.status))
  }
  try {
    await client.promptAgent(agent.attachTarget, text)
  } catch (error) {
    if (error instanceof HerdrApiError && error.code === 'agent_not_found') {
      throw new AgentServiceError('agent_not_found', error.message, { cause: error })
    }
    if (error instanceof HerdrApiError && error.code === 'agent_blocked') {
      throw new AgentServiceError('agent_not_ready', error.message, { cause: error })
    }
    const message = error instanceof HerdrApiError ? error.message : 'The Prompt could not be sent.'
    throw new AgentServiceError('agent_prompt_unavailable', message, { cause: error })
  }
}

const focusAgent = async (runtime: AgentRuntime, agentId: string): Promise<void> => {
  const [agent, client] = connectedAgent(runtime, agentId)
  try {
    await client.focusAgent(agent.attachTarget)
  } catch (error) {
    if (error instanceof HerdrApiError && error.code === 'agent_not_found') {
      throw new AgentServiceError('agent_not_found', error.message, { cause: error })
    }
    const message = error instanceof HerdrApiError ? error.message : 'The Agent could not be focused.'
    throw new AgentServiceError('agent_focus_unavailable', message, { cause: error })
  }
}

export const createAgentService = (): AgentService => {
  const runtime = createAgentRuntime()
  return {
    start: runtime.start,
    stop: runtime.stop,
    snapshot: runtime.snapshot,
    subscribe: runtime.subscribe,
    output: agentId => readOutput(runtime, agentId),
    prompt: (agentId, text) => submitPrompt(runtime, agentId, text),
    focus: agentId => focusAgent(runtime, agentId),
    launch: (project, provider, prompt) =>
      launchAgent(connectedClient(runtime), project, provider, prompt),
  }
}
