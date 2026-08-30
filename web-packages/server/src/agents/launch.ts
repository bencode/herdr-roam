import { realpath, stat } from 'node:fs/promises'
import type {
  AgentApiError,
  AgentLaunchReceipt,
  AgentLaunchRecovery,
  AgentProvider,
  Project,
} from '@herdr-roam/shared'
import { HerdrApiError, type HerdrClient } from '../herdr/client.js'
import type { RawAgent } from '../herdr/schema.js'
import { mapAgent } from './mapper.js'

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

const ensureProjectDirectory = async (project: Project): Promise<void> => {
  try {
    const canonical = await realpath(project.path)
    if (canonical !== project.path || !(await stat(canonical)).isDirectory()) {
      throw new Error('Project path no longer resolves to its registered directory.')
    }
  } catch (error) {
    throw new AgentLaunchError(
      'project_directory_unavailable',
      `Project directory ${project.path} is unavailable.`,
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

const launchFailure = (
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
      throw new AgentLaunchError('agent_launch_unavailable', `Agent name ${name} was lost during startup.`)
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
): Promise<RawAgent> => {
  const deadline = Date.now() + START_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      return await client.startAgent(name, provider, paneId, START_TIMEOUT_MS)
    } catch (error) {
      if (!(error instanceof HerdrApiError) || error.code !== 'agent_pane_busy') throw error
      await sleep(START_POLL_MS)
    }
  }
  throw new AgentLaunchError('agent_start_timeout', `Timed out waiting for Pane ${paneId} to become available.`)
}

export const launchAgent = async (
  client: HerdrClient,
  project: Project,
  provider: AgentProvider,
  prompt: string,
): Promise<AgentLaunchReceipt> => {
  await ensureProjectDirectory(project)
  let existing: readonly RawAgent[]
  try {
    existing = await client.listAgents()
  } catch (error) {
    throw new AgentLaunchError('agent_launch_unavailable', 'Herdr Agents could not be listed.', null, {
      cause: error,
    })
  }
  const name = generatedAgentName(
    project.name,
    provider,
    new Set(existing.flatMap(agent => (agent.name ? [agent.name] : []))),
  )
  let workspace: Awaited<ReturnType<HerdrClient['createWorkspace']>>
  try {
    workspace = await client.createWorkspace(project.path, name)
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
    started = await startWhenAvailable(client, name, provider, workspace.paneId)
  } catch (error) {
    throw launchFailure(error, 'agent_start', workspace)
  }
  let ready: RawAgent
  try {
    ready = await waitUntilReady(client, name, provider, started)
  } catch (error) {
    throw launchFailure(error, 'agent_ready', workspace, started.terminal_id)
  }
  try {
    await client.promptAgent(name, prompt)
  } catch (error) {
    throw launchFailure(error, 'initial_prompt', workspace, ready.terminal_id)
  }
  return {
    agent: mapAgent(ready),
    workspaceId: workspace.workspaceId,
    paneId: workspace.paneId,
  }
}
