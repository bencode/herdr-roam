import { realpath, stat } from 'node:fs/promises'
import type { AgentLaunchReceipt, AgentProvider, Project } from '@herdr-roam/shared'
import type { HerdrClient } from '../herdr/client.js'
import { mapAgent } from './mapper.js'
import {
  AgentLaunchError,
  generatedAgentName,
  launchFailure,
  listManagedAgents,
  startManagedAgent,
} from './start.js'

export { AgentLaunchError, generatedAgentName } from './start.js'

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

export const launchAgent = async (
  client: HerdrClient,
  project: Project,
  provider: AgentProvider,
  prompt: string,
): Promise<AgentLaunchReceipt> => {
  await ensureProjectDirectory(project)
  const existing = await listManagedAgents(client)
  const name = generatedAgentName(
    project.name,
    provider,
    new Set(existing.flatMap(agent => (agent.name ? [agent.name] : []))),
  )
  const started = await startManagedAgent(client, project.path, name, provider, [])
  try {
    await client.promptAgent(name, prompt)
  } catch (error) {
    throw launchFailure(error, 'initial_prompt', started.workspace, started.agent.terminal_id)
  }
  return {
    agent: mapAgent(started.agent),
    workspaceId: started.workspace.workspaceId,
    paneId: started.workspace.paneId,
  }
}
