import type { AgentLaunchReceipt, AgentProvider, Project } from '@herdr-roam/shared'
import type { HerdrClient } from '../herdr/client.js'
import { resolveProjectWorkspace } from '../projects/workspaces.js'
import { mapAgent } from './mapper.js'
import { generatedAgentName, launchFailure, listManagedAgents, startManagedAgent } from './start.js'

export { AgentLaunchError, generatedAgentName } from './start.js'

export const launchAgent = async (
  client: HerdrClient,
  project: Project,
  provider: AgentProvider,
  prompt?: string,
  workspaceId = 'primary',
): Promise<AgentLaunchReceipt> => {
  const workspace = await resolveProjectWorkspace(project, workspaceId)
  const existing = await listManagedAgents(client)
  const name = generatedAgentName(
    project.name,
    provider,
    new Set(existing.flatMap(agent => (agent.name ? [agent.name] : []))),
  )
  const started = await startManagedAgent(client, workspace.path, name, provider, [])
  if (prompt !== undefined) {
    try {
      await client.promptAgent(name, prompt)
    } catch (error) {
      throw launchFailure(error, 'initial_prompt', started.workspace, started.agent.terminal_id)
    }
  }
  return {
    agent: mapAgent(started.agent),
    workspaceId: started.workspace.workspaceId,
    paneId: started.workspace.paneId,
  }
}
