import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ launch: vi.fn() }))

vi.mock('../../agent/client', async importOriginal => {
  const original = await importOriginal<typeof import('../../agent/client')>()
  return { ...original, launchProjectAgent: mocks.launch }
})
vi.mock('../../agent/runtime-provider', () => ({
  useAgentRuntime: () => ({
    snapshot: {
      source: { state: 'connected' as const, version: '0.8.2', protocol: 20 },
      stale: false,
      items: [],
      observedDirectories: [],
    },
  }),
}))

import { AgentClientError } from '../../agent/client'
import { AgentLauncher } from './agent-launcher'

const project = { name: 'herdr-roam', path: '/work/herdr-roam' }

describe('Workbench Agent launcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('starts the selected provider and opens its Inspector', async () => {
    const onOpen = vi.fn()
    mocks.launch.mockResolvedValue({
      agent: {
        id: 'terminal-1',
        name: 'claude-herdr-roam',
        provider: 'claude',
        status: 'idle',
        cwd: project.path,
        attachTarget: 'w1:p1',
      },
      workspaceId: 'workspace-1',
      paneId: 'w1:p1',
    })
    render(<AgentLauncher project={project} onOpen={onOpen} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Agent provider' }), {
      target: { value: 'claude' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Describe the work' }), {
      target: { value: 'Review the change.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start claude' }))

    await waitFor(() =>
      expect(mocks.launch).toHaveBeenCalledWith({
        projectName: 'herdr-roam',
        provider: 'claude',
        prompt: 'Review the change.',
      }),
    )
    expect(onOpen).toHaveBeenCalledWith({ type: 'agent', agentId: 'terminal-1' })
  })

  it('preserves the Prompt and exposes recovery after a partial launch', async () => {
    mocks.launch.mockRejectedValue(
      new AgentClientError('agent_prompt_unavailable', 'Prompt failed.', {
        phase: 'initial_prompt',
        workspaceId: 'workspace-1',
        paneId: 'w1:p1',
        terminalId: 'terminal-1',
        agentId: 'terminal-1',
        attachCommand: 'herdr terminal attach terminal-1',
      }),
    )
    render(<AgentLauncher project={project} onOpen={() => undefined} />)
    const prompt = screen.getByRole('textbox', { name: 'Describe the work' })
    fireEvent.change(prompt, { target: { value: 'Keep this Prompt.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start codex' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Workspace was kept')
    expect(prompt).toHaveValue('Keep this Prompt.')
    fireEvent.click(screen.getByRole('button', { name: 'Copy attach' }))
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'herdr terminal attach terminal-1',
      ),
    )
  })
})
