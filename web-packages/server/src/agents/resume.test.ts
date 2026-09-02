import { execFile } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { Project, SessionSummary } from '@herdr-roam/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HerdrClient } from '../herdr/client.js'
import type { RawAgent } from '../herdr/schema.js'
import { resumeAgent } from './resume.js'

const directories: string[] = []
const execFileAsync = promisify(execFile)

const git = async (cwd: string, args: readonly string[]): Promise<void> => {
  await execFileAsync('git', ['-C', cwd, ...args])
}

const rawAgent = (values: Partial<RawAgent> = {}): RawAgent => ({
  terminal_id: 'terminal-1',
  agent_status: 'idle',
  workspace_id: 'workspace-1',
  tab_id: 'tab-1',
  pane_id: 'w1:p1',
  name: 'codex-herdr-roam',
  agent: 'codex',
  interactive_ready: true,
  launch_pending: false,
  ...values,
})

const client = (values: Partial<HerdrClient> = {}): HerdrClient => ({
  listAgents: vi.fn().mockResolvedValue([]),
  readAgent: vi.fn(),
  promptAgent: vi.fn(),
  sendAgentKeys: vi.fn(),
  sendPaneInput: vi.fn(),
  closePane: vi.fn(),
  createWorkspace: vi.fn().mockResolvedValue({
    workspaceId: 'workspace-1',
    paneId: 'w1:p1',
    terminalId: 'terminal-1',
  }),
  startAgent: vi.fn().mockResolvedValue(rawAgent()),
  getAgent: vi.fn().mockResolvedValue(rawAgent()),
  focusAgent: vi.fn(),
  subscribe: vi.fn(),
  ...values,
})

const fixture = async (): Promise<{
  readonly project: Project
  readonly session: SessionSummary
}> => {
  const path = await mkdtemp(join(tmpdir(), 'herdr-roam-resume-'))
  directories.push(path)
  const cwd = await realpath(path)
  return {
    project: { name: 'herdr-roam', path: cwd },
    session: {
      id: 'session-1',
      provider: 'codex',
      title: 'Review release',
      cwd,
      createdAt: null,
      updatedAt: '2026-09-01T09:00:00.000Z',
    },
  }
}

const addWorktree = async (projectPath: string): Promise<string> => {
  await git(projectPath, ['init', '--quiet'])
  await writeFile(join(projectPath, 'README.md'), 'fixture\n')
  await git(projectPath, ['add', 'README.md'])
  await git(projectPath, [
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.com',
    'commit',
    '--quiet',
    '-m',
    'fixture',
  ])
  const worktree = join(projectPath, '.worktrees', 'task')
  await git(projectPath, ['worktree', 'add', '--quiet', '--detach', worktree])
  return realpath(worktree)
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('Session resume', () => {
  it('reuses an Agent already attached to the same provider Session', async () => {
    const existing = rawAgent({
      agent_session: { source: 'process', agent: 'codex', kind: 'id', value: 'session-1' },
    })
    const runtime = client({ listAgents: vi.fn().mockResolvedValue([existing]) })
    const { project, session } = await fixture()

    await expect(resumeAgent(runtime, project, session, session.cwd)).resolves.toMatchObject({
      reused: true,
      agent: { id: 'terminal-1' },
    })
    expect(runtime.createWorkspace).not.toHaveBeenCalled()
  })

  it('starts Codex non-interactively in the registered Project by default', async () => {
    const runtime = client()
    const { project, session } = await fixture()

    await expect(resumeAgent(runtime, project, session, session.cwd)).resolves.toMatchObject({
      reused: false,
    })
    expect(runtime.createWorkspace).toHaveBeenCalledWith(project.path, 'codex-herdr-roam')
    expect(runtime.startAgent).toHaveBeenCalledWith(
      'codex-herdr-roam',
      'codex',
      'w1:p1',
      ['resume', '-c', 'tui.resume_cwd="current"', 'session-1'],
      30_000,
    )
  })

  it('resumes in a previous worktree from the same Git repository', async () => {
    const runtime = client()
    const { project, session } = await fixture()
    const worktree = await addWorktree(project.path)

    await resumeAgent(runtime, project, session, worktree)

    expect(runtime.createWorkspace).toHaveBeenCalledWith(worktree, 'codex-herdr-roam')
  })

  it('falls back to the Project when the previous worktree is unavailable', async () => {
    const runtime = client()
    const { project, session } = await fixture()

    await resumeAgent(runtime, project, session, join(project.path, '.worktrees', 'missing'))

    expect(runtime.createWorkspace).toHaveBeenCalledWith(project.path, 'codex-herdr-roam')
  })

  it('does not resume in a directory from another Git repository', async () => {
    const runtime = client()
    const { project, session } = await fixture()
    const foreign = await fixture()
    await Promise.all([addWorktree(project.path), addWorktree(foreign.project.path)])

    await resumeAgent(runtime, project, session, foreign.project.path)

    expect(runtime.createWorkspace).toHaveBeenCalledWith(project.path, 'codex-herdr-roam')
  })

  it('leaves Claude resume arguments unchanged', async () => {
    const claudeAgent = rawAgent({ name: 'claude-herdr-roam', agent: 'claude' })
    const runtime = client({
      startAgent: vi.fn().mockResolvedValue(claudeAgent),
      getAgent: vi.fn().mockResolvedValue(claudeAgent),
    })
    const { project, session } = await fixture()
    const claude = { ...session, provider: 'claude' as const }

    await resumeAgent(runtime, project, claude, project.path)

    expect(runtime.startAgent).toHaveBeenCalledWith(
      'claude-herdr-roam',
      'claude',
      'w1:p1',
      ['--resume', 'session-1'],
      30_000,
    )
  })
})
