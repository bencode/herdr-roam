import type { AgentApiError, AgentLaunchRecovery, AgentProvider } from '@herdr-roam/shared'
import { HerdrApiError, type HerdrClient } from '../herdr/client.js'
import type { RawAgent } from '../herdr/schema.js'

const START_TIMEOUT_MS = 30_000
const START_POLL_MS = 250

type LaunchErrorCode = AgentApiError['error']['code']

export class AgentLaunchError extends Error {
  readonly code: LaunchErrorCode
  readonly recovery: AgentLaunchRecovery | null

  constructor(
    code: LaunchErrorCode,
    message: string,
    recovery: AgentLaunchRecovery | null = null,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'AgentLaunchError'
    this.code = code
    this.recovery = recovery
  }
}

const sleep = (milliseconds: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, milliseconds))

const candidateName = (base: string, index: number): string => {
  const suffix = index === 0 ? '' : `-${index + 1}`
  return `${base.slice(0, 32 - suffix.length).replace(/-+$/, '')}${suffix}`
}

export const generatedAgentName = (
  projectName: string,
  provider: AgentProvider,
  existingNames: ReadonlySet<string>,
): string => {
  const projectPart = projectName
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  const base = `${provider}-${projectPart || 'project'}`
  return (
    Array.from({ length: existingNames.size + 2 }, (_, index) => candidateName(base, index)).find(
      name => !existingNames.has(name),
    ) ?? candidateName(base, existingNames.size + 2)
  )
}

export const listManagedAgents = async (client: HerdrClient): Promise<readonly RawAgent[]> => {
  try {
    return await client.listAgents()
  } catch (error) {
    throw new AgentLaunchError(
      'agent_launch_unavailable',
      'Herdr Agents could not be listed.',
      null,
      { cause: error },
    )
  }
}

const recovery = (
  phase: AgentLaunchRecovery['phase'],
  workspace: { readonly workspaceId: string; readonly paneId: string; readonly terminalId: string },
  agentId?: string,
): AgentLaunchRecovery => ({
  phase,
  ...workspace,
  ...(agentId ? { agentId } : {}),
  attachCommand: `herdr terminal attach ${workspace.terminalId}`,
})

export const launchFailure = (
  error: unknown,
  phase: AgentLaunchRecovery['phase'],
  workspace: { readonly workspaceId: string; readonly paneId: string; readonly terminalId: string },
  agentId?: string,
): AgentLaunchError => {
  const code =
    error instanceof AgentLaunchError
      ? error.code
      : phase === 'initial_prompt'
        ? 'agent_prompt_unavailable'
        : 'agent_launch_unavailable'
  const message =
    error instanceof Error
      ? error.message
      : phase === 'initial_prompt'
        ? 'The initial Prompt could not be submitted.'
        : 'The Agent could not be started.'
  return new AgentLaunchError(code, message, recovery(phase, workspace, agentId), { cause: error })
}

const resolvedAgent = async (
  client: HerdrClient,
  name: string,
  paneId: string,
): Promise<RawAgent | null> => {
  try {
    return await client.getAgent(name)
  } catch (error) {
    if (!(error instanceof HerdrApiError) || error.code !== 'agent_not_found') throw error
  }
  try {
    return await client.getAgent(paneId)
  } catch (error) {
    if (error instanceof HerdrApiError && error.code === 'agent_not_found') return null
    throw error
  }
}

const waitUntilReady = async (
  client: HerdrClient,
  name: string,
  provider: AgentProvider,
  started: RawAgent,
): Promise<RawAgent> => {
  const deadline = Date.now() + START_TIMEOUT_MS
  while (Date.now() < deadline) {
    const agent = await resolvedAgent(client, name, started.pane_id)
    if (!agent) {
      await sleep(START_POLL_MS)
      continue
    }
    if (agent.terminal_id !== started.terminal_id || agent.name !== name) {
      throw new AgentLaunchError(
        'agent_launch_unavailable',
        `Agent name ${name} was lost during startup.`,
      )
    }
    if (agent.agent && agent.agent !== provider) {
      throw new AgentLaunchError(
        'agent_kind_mismatch',
        `Expected ${provider}, but Herdr detected ${agent.agent}.`,
      )
    }
    if (agent.agent_status === 'blocked') {
      throw new AgentLaunchError(
        'agent_launch_unavailable',
        `Agent ${name} is blocked during startup.`,
      )
    }
    if (
      (agent.agent_status === 'idle' || agent.agent_status === 'done') &&
      agent.interactive_ready === true
    ) {
      return agent
    }
    if (
      (agent.agent_status === 'idle' || agent.agent_status === 'done') &&
      agent.launch_pending !== true
    ) {
      throw new AgentLaunchError(
        'agent_launch_unavailable',
        `Agent ${name} exited before becoming interactive.`,
      )
    }
    await sleep(START_POLL_MS)
  }
  throw new AgentLaunchError('agent_start_timeout', `Timed out waiting for Agent ${name} to start.`)
}

const startWhenAvailable = async (
  client: HerdrClient,
  name: string,
  provider: AgentProvider,
  paneId: string,
  args: readonly string[],
): Promise<RawAgent> => {
  const deadline = Date.now() + START_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      return await client.startAgent(name, provider, paneId, args, START_TIMEOUT_MS)
    } catch (error) {
      if (!(error instanceof HerdrApiError) || error.code !== 'agent_pane_busy') throw error
      await sleep(START_POLL_MS)
    }
  }
  throw new AgentLaunchError(
    'agent_start_timeout',
    `Timed out waiting for Pane ${paneId} to become available.`,
  )
}

export type ManagedAgentStart = {
  readonly agent: RawAgent
  readonly workspace: {
    readonly workspaceId: string
    readonly paneId: string
    readonly terminalId: string
  }
}

export const startManagedAgent = async (
  client: HerdrClient,
  cwd: string,
  name: string,
  provider: AgentProvider,
  args: readonly string[],
): Promise<ManagedAgentStart> => {
  let workspace: ManagedAgentStart['workspace']
  try {
    workspace = await client.createWorkspace(cwd, name)
  } catch (error) {
    throw new AgentLaunchError(
      'agent_launch_unavailable',
      error instanceof Error ? error.message : 'Herdr Workspace could not be created.',
      null,
      { cause: error },
    )
  }
  let started: RawAgent
  try {
    started = await startWhenAvailable(client, name, provider, workspace.paneId, args)
  } catch (error) {
    throw launchFailure(error, 'agent_start', workspace)
  }
  try {
    return { agent: await waitUntilReady(client, name, provider, started), workspace }
  } catch (error) {
    throw launchFailure(error, 'agent_ready', workspace, started.terminal_id)
  }
}
