import { mkdtemp, realpath, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type HerdrClient, HerdrApiError } from '../herdr/client.js'
import type { RawAgent } from '../herdr/schema.js'
import { type AgentLaunchError, generatedAgentName, launchAgent } from './launch.js'

const directories: string[] = []

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
  readAgent: vi.fn().mockResolvedValue(''),
  promptAgent: vi.fn().mockResolvedValue(undefined),
  createWorkspace: vi.fn().mockResolvedValue({
    workspaceId: 'workspace-1',
    paneId: 'w1:p1',
    terminalId: 'terminal-1',
  }),
  startAgent: vi.fn().mockResolvedValue(rawAgent()),
  getAgent: vi.fn().mockResolvedValue(rawAgent()),
  focusAgent: vi.fn().mockResolvedValue(rawAgent()),
  subscribe: vi.fn().mockResolvedValue(() => undefined),
  ...values,
})

const project = async () => {
  const path = await mkdtemp(join(tmpdir(), 'herdr-roam-launch-'))
  directories.push(path)
  return { name: 'herdr-roam', path: await realpath(path) }
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('Agent launch', () => {
  it('generates deterministic names within the Herdr limit', () => {
    expect(generatedAgentName('herdr.roam', 'codex', new Set(['codex-herdr-roam']))).toBe(
      'codex-herdr-roam-2',
    )
    expect(generatedAgentName('a'.repeat(64), 'claude', new Set())).toHaveLength(32)
  })

  it('creates a Workspace, waits for readiness, and submits the initial Prompt', async () => {
    const startAgent = vi
      .fn()
      .mockRejectedValueOnce(new HerdrApiError('agent_pane_busy', 'shell initializing'))
      .mockResolvedValue(rawAgent())
    const runtime = client({ startAgent })
    const receipt = await launchAgent(runtime, await project(), 'codex', 'Review the change.')

    expect(runtime.createWorkspace).toHaveBeenCalledWith(
      expect.stringContaining('herdr-roam-launch-'),
      'codex-herdr-roam',
    )
    expect(runtime.startAgent).toHaveBeenCalledWith('codex-herdr-roam', 'codex', 'w1:p1', 30_000)
    expect(runtime.startAgent).toHaveBeenCalledTimes(2)
    expect(runtime.promptAgent).toHaveBeenCalledWith('codex-herdr-roam', 'Review the change.')
    expect(receipt).toMatchObject({
      agent: { id: 'terminal-1', provider: 'codex' },
      workspaceId: 'workspace-1',
      paneId: 'w1:p1',
    })
  })

  it('keeps recovery details when the initial Prompt fails', async () => {
    const runtime = client({ promptAgent: vi.fn().mockRejectedValue(new Error('prompt failed')) })

    await expect(
      launchAgent(runtime, await project(), 'codex', 'Review the change.'),
    ).rejects.toMatchObject({
      code: 'agent_prompt_unavailable',
      recovery: {
        phase: 'initial_prompt',
        workspaceId: 'workspace-1',
        paneId: 'w1:p1',
        terminalId: 'terminal-1',
        agentId: 'terminal-1',
        attachCommand: 'herdr terminal attach terminal-1',
      },
    } satisfies Partial<AgentLaunchError>)
  })
})
