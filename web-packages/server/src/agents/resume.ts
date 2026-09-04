import type {
  AgentProvider,
  Project,
  SessionResumeReceipt,
  SessionSummary,
} from '@herdr-roam/shared'
import type { HerdrClient } from '../herdr/client.js'
import type { RawAgent } from '../herdr/schema.js'
import { existingDirectory, gitLocation } from '../projects/git.js'
import { mapAgent } from './mapper.js'
import {
  AgentLaunchError,
  generatedAgentName,
  listManagedAgents,
  startManagedAgent,
} from './start.js'

const resumeArgs = (provider: AgentProvider, sessionId: string): readonly string[] =>
  provider === 'codex'
    ? ['resume', '-c', 'tui.resume_cwd="current"', sessionId]
    : ['--resume', sessionId]

const matchingAgent = (
  agents: readonly RawAgent[],
  provider: AgentProvider,
  sessionId: string,
): RawAgent | null =>
  agents.find(
    agent =>
      agent.agent_session?.agent === provider &&
      agent.agent_session?.kind === 'id' &&
      agent.agent_session?.value === sessionId,
  ) ?? null

const projectDirectory = async (project: Project): Promise<string> => {
  const directory = await existingDirectory(project.path)
  if (!directory) {
    throw new AgentLaunchError(
      'project_directory_unavailable',
      `Project directory ${project.path} is unavailable.`,
      null,
    )
  }
  return directory
}

const resumeDirectory = async (project: Project, latestCwd: string): Promise<string> => {
  const projectPath = await projectDirectory(project)
  const candidatePath = await existingDirectory(latestCwd)
  if (!candidatePath || candidatePath === projectPath) return projectPath

  const [projectGit, candidateGit] = await Promise.all([
    gitLocation(projectPath),
    gitLocation(candidatePath),
  ])
  return projectGit &&
    candidateGit &&
    projectGit.commonDirectory === candidateGit.commonDirectory &&
    projectGit.topLevel !== candidateGit.topLevel
    ? candidatePath
    : projectPath
}

export const resumeAgent = async (
  client: HerdrClient,
  project: Project,
  session: SessionSummary,
  latestCwd: string,
): Promise<SessionResumeReceipt> => {
  const existing = await listManagedAgents(client)
  const active = matchingAgent(existing, session.provider, session.id)
  if (active) return { agent: mapAgent(active), reused: true }

  const cwd = await resumeDirectory(project, latestCwd)
  const name = generatedAgentName(
    project.name,
    session.provider,
    new Set(existing.flatMap(agent => (agent.name ? [agent.name] : []))),
  )
  const started = await startManagedAgent(
    client,
    cwd,
    name,
    session.provider,
    resumeArgs(session.provider, session.id),
  )
  return { agent: mapAgent(started.agent), reused: false }
}
