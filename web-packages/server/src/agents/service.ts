import type {
  AgentInputRequest,
  AgentLaunchReceipt,
  AgentOutput,
  AgentProvider,
  AgentRuntimeSnapshot,
  AgentSummary,
  Project,
  SessionResumeReceipt,
  SessionSummary,
} from '@herdr-roam/shared'
import { HerdrApiError, type HerdrClient } from '../herdr/client.js'
import { type PromptImage, stagePromptImages } from './images.js'
import { launchAgent } from './launch.js'
import { resumeAgent } from './resume.js'
import { type AgentRuntime, createAgentRuntime } from './runtime.js'

type Listener = (snapshot: AgentRuntimeSnapshot) => void

export type AgentPromptInput = {
  readonly text: string
  readonly images: readonly PromptImage[]
}

export type AgentServiceApi = {
  readonly snapshot: () => AgentRuntimeSnapshot
  readonly subscribe: (listener: Listener) => () => void
  readonly output: (agentId: string) => Promise<Omit<AgentOutput, 'agentId'>>
  readonly prompt: (agentId: string, input: AgentPromptInput) => Promise<void>
  readonly input: (agentId: string, request: AgentInputRequest) => Promise<void>
  readonly focus: (agentId: string) => Promise<void>
  readonly stopAgent: (agentId: string) => Promise<void>
  readonly launch: (
    project: Project,
    provider: AgentProvider,
    prompt: string,
  ) => Promise<AgentLaunchReceipt>
  readonly resume: (
    project: Project,
    session: SessionSummary,
    latestCwd: string,
  ) => Promise<SessionResumeReceipt>
}

const AGENT_OUTPUT_LINES = 500
const AGENT_OUTPUT_MAX_BYTES = 512 * 1024

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
  | 'agent_input_unavailable'
  | 'agent_focus_unavailable'
  | 'agent_stop_unavailable'

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

const boundedOutput = (text: string): Omit<AgentOutput, 'agentId'> => {
  const bytes = Buffer.from(text, 'utf8')
  if (bytes.length <= AGENT_OUTPUT_MAX_BYTES) return { text, truncated: false }
  const reset = Buffer.from('\u001b[0m', 'utf8')
  let start = bytes.length - (AGENT_OUTPUT_MAX_BYTES - reset.length)
  while (start < bytes.length && (bytes[start] ?? 0) >> 6 === 2) start += 1
  const newline = bytes.indexOf(10, start)
  if (newline >= 0 && newline < bytes.length - 1) start = newline + 1
  return { text: Buffer.concat([reset, bytes.subarray(start)]).toString('utf8'), truncated: true }
}

const readOutput = async (
  runtime: AgentRuntime,
  agentId: string,
): Promise<Omit<AgentOutput, 'agentId'>> => {
  const [agent, client] = connectedAgent(runtime, agentId)
  try {
    return boundedOutput(await client.readAgent(agent.attachTarget, AGENT_OUTPUT_LINES))
  } catch (error) {
    const message = error instanceof HerdrApiError ? error.message : 'Recent output is unavailable.'
    throw new AgentServiceError('agent_output_unavailable', message, { cause: error })
  }
}

const submitPrompt = async (
  runtime: AgentRuntime,
  agentId: string,
  input: AgentPromptInput,
): Promise<void> => {
  const [agent, client] = connectedAgent(runtime, agentId)
  if (agent.status !== 'idle' && agent.status !== 'done' && agent.status !== 'working') {
    throw new AgentServiceError('agent_not_ready', promptNotReadyMessage(agent.status))
  }
  try {
    if (input.images.length === 0) {
      await client.promptAgent(agent.attachTarget, input.text)
      return
    }

    const paths = await stagePromptImages(input.images)
    for (const path of paths) await client.sendPaneInput(agent.attachTarget, path, [])
    if (input.text.trim()) await client.promptAgent(agent.attachTarget, input.text)
    else await client.sendAgentKeys(agent.attachTarget, ['enter'])
  } catch (error) {
    if (error instanceof HerdrApiError && error.code === 'agent_not_found') {
      throw new AgentServiceError('agent_not_found', error.message, { cause: error })
    }
    if (error instanceof HerdrApiError && error.code === 'agent_blocked') {
      throw new AgentServiceError('agent_not_ready', error.message, { cause: error })
    }
    const message =
      error instanceof HerdrApiError
        ? error.message
        : input.images.length > 0
          ? 'The image Prompt could not be sent. Inspect the native composer before retrying.'
          : 'The Prompt could not be sent.'
    throw new AgentServiceError('agent_prompt_unavailable', message, { cause: error })
  }
}

const isModeToggle = (request: AgentInputRequest): boolean =>
  request.type === 'keys' && request.keys.length === 1 && request.keys[0] === 'shift+tab'

const submitInput = async (
  runtime: AgentRuntime,
  agentId: string,
  request: AgentInputRequest,
): Promise<void> => {
  const [agent, client] = connectedAgent(runtime, agentId)
  if (agent.status !== 'blocked' && !isModeToggle(request)) {
    throw new AgentServiceError(
      'agent_not_ready',
      'Direct terminal input is available only while the Agent is blocked.',
    )
  }

  try {
    if (request.type === 'keys') {
      await client.sendAgentKeys(agent.attachTarget, request.keys)
      return
    }
    await client.sendPaneInput(agent.attachTarget, request.text, [])
  } catch (error) {
    if (error instanceof HerdrApiError && error.code === 'agent_not_found') {
      throw new AgentServiceError('agent_not_found', error.message, { cause: error })
    }
    const message =
      error instanceof HerdrApiError ? error.message : 'The Agent input could not be sent.'
    throw new AgentServiceError('agent_input_unavailable', message, { cause: error })
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
    const message =
      error instanceof HerdrApiError ? error.message : 'The Agent could not be focused.'
    throw new AgentServiceError('agent_focus_unavailable', message, { cause: error })
  }
}

const stopAgent = async (runtime: AgentRuntime, agentId: string): Promise<void> => {
  const [agent, client] = connectedAgent(runtime, agentId)
  try {
    await client.closePane(agent.attachTarget)
  } catch (error) {
    const message = error instanceof HerdrApiError ? error.message : 'The Agent could not be stopped.'
    throw new AgentServiceError('agent_stop_unavailable', message, { cause: error })
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
    prompt: (agentId, input) => submitPrompt(runtime, agentId, input),
    input: (agentId, request) => submitInput(runtime, agentId, request),
    focus: agentId => focusAgent(runtime, agentId),
    stopAgent: agentId => stopAgent(runtime, agentId),
    launch: (project, provider, prompt) =>
      launchAgent(connectedClient(runtime), project, provider, prompt),
    resume: (project, session, latestCwd) =>
      resumeAgent(connectedClient(runtime), project, session, latestCwd),
  }
}
