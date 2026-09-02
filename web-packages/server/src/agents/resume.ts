import { execFile } from 'node:child_process'
import { realpath, stat } from 'node:fs/promises'
import { promisify } from 'node:util'
import type {
  AgentProvider,
  Project,
  SessionResumeReceipt,
  SessionSummary,
} from '@herdr-roam/shared'
import type { HerdrClient } from '../herdr/client.js'
import type { RawAgent } from '../herdr/schema.js'
import { mapAgent } from './mapper.js'
import {
  AgentLaunchError,
  generatedAgentName,
  listManagedAgents,
  startManagedAgent,
} from './start.js'

const execFileAsync = promisify(execFile)

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

type GitLocation = {
  readonly topLevel: string
  readonly commonDirectory: string
}

const existingDirectory = async (path: string): Promise<string | null> => {
  try {
    const canonical = await realpath(path)
    return (await stat(canonical)).isDirectory() ? canonical : null
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
    if (code !== 'ENOENT' && code !== 'ENOTDIR') {
      console.error(`Resume directory ${path} could not be inspected`, error)
    }
    return null
  }
}

const gitLocation = async (cwd: string): Promise<GitLocation | null> => {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', cwd, 'rev-parse', '--path-format=absolute', '--show-toplevel', '--git-common-dir'],
      { encoding: 'utf8', timeout: 5_000 },
    )
    const [topLevel, commonDirectory, ...extra] = stdout.trim().split('\n')
    if (!topLevel || !commonDirectory || extra.length > 0) {
      throw new Error('Git returned an invalid worktree location.')
    }
    const [canonicalTopLevel, canonicalCommonDirectory] = await Promise.all([
      realpath(topLevel),
      realpath(commonDirectory),
    ])
    return { topLevel: canonicalTopLevel, commonDirectory: canonicalCommonDirectory }
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
    if (typeof code !== 'number') console.error(`Git worktree inspection failed for ${cwd}`, error)
    return null
  }
}

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
