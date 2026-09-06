import type { AgentLaunchReceipt } from '@herdr-roam/shared'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Activity } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  launch: vi.fn(),
  register: vi.fn(),
  directories: vi.fn(),
  runtimeConnected: true,
}))
vi.mock('../../agent/client', async importOriginal => {
  const original = await importOriginal<typeof import('../../agent/client')>()
  return { ...original, launchProjectAgent: mocks.launch }
})
vi.mock('../../project/workspace-client', async importOriginal => ({
  ...(await importOriginal<typeof import('../../project/workspace-client')>()),
  fetchProjectWorkspaces: mocks.directories,
}))
vi.mock('../../agent/runtime-provider', () => ({
  useAgentRuntime: () => ({
    registerStartedAgent: mocks.register,
    snapshot: {
      source: mocks.runtimeConnected
        ? { state: 'connected', version: '0.8.2', protocol: 20 }
        : { state: 'unavailable', code: 'herdr_not_running', message: 'Herdr is not running.' },
      stale: false,
      items: [],
    },
  }),
}))

import { AgentClientError } from '../../agent/client'
import { AgentLauncher } from './agent-launcher'

const project = { name: 'herdr-roam', path: '/work/herdr-roam' }
const primary = {
  id: 'primary',
  name: project.name,
  path: project.path,
  branch: 'main',
  primary: true,
  kind: 'worktree',
}
const task = {
  ...primary,
  id: 'task',
  name: 'linked-task',
  path: '/tmp/linked-task',
  branch: 'task',
  primary: false,
}
const receipt: AgentLaunchReceipt = {
  agent: {
    id: 'terminal-1',
    name: 'codex-herdr-roam',
    provider: 'codex',
    status: 'idle',
    cwd: project.path,
    attachTarget: 'w1:p1',
    session: null,
  },
  workspaceId: 'workspace-1',
  paneId: 'w1:p1',
}

const ready = () =>
  waitFor(() => expect(screen.getByRole('button', { name: 'Open Codex' })).toBeEnabled())

describe('New Session launcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runtimeConnected = true
    mocks.directories.mockResolvedValue({ items: [primary, task] })
    mocks.launch.mockResolvedValue(receipt)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('opens the selected provider in the selected worktree without a Prompt', async () => {
    const onOpen = vi.fn()
    render(<AgentLauncher project={project} onOpen={onOpen} />)
    await ready()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(mocks.launch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Working directory' }))
    fireEvent.click(screen.getByRole('option', { name: /linked-task/ }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Agent provider' }), {
      target: { value: 'claude' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open Claude' }))
    await waitFor(() =>
      expect(onOpen).toHaveBeenCalledWith({ type: 'agent', agentId: receipt.agent.id }),
    )
    expect(mocks.launch).toHaveBeenCalledWith({
      projectName: project.name,
      provider: 'claude',
      workspaceId: 'task',
    })
    expect(mocks.register).toHaveBeenCalledWith(receipt.agent)
    expect(mocks.register.mock.invocationCallOrder[0]).toBeLessThan(
      onOpen.mock.invocationCallOrder[0] ?? 0,
    )
  })

  it.each(['another project', 'another tab'])(
    'does not navigate after leaving for %s during startup',
    async destination => {
      let complete: ((value: AgentLaunchReceipt) => void) | undefined
      mocks.launch.mockReturnValue(
        new Promise<AgentLaunchReceipt>(resolve => {
          complete = resolve
        }),
      )
      const onOpen = vi.fn()
      const view = render(<AgentLauncher project={project} onOpen={onOpen} />)
      await ready()
      fireEvent.submit(screen.getByRole('form', { name: 'New Session' }))
      fireEvent.submit(screen.getByRole('form', { name: 'New Session' }))
      expect(mocks.launch).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: 'Opening…' })).toBeDisabled()
      view.rerender(
        <AgentLauncher
          project={destination === 'another project' ? { name: 'other', path: '/other' } : project}
          visible={destination !== 'another tab'}
          onOpen={onOpen}
        />,
      )
      await act(async () => {
        complete?.(receipt)
      })
      expect(mocks.register).toHaveBeenCalledWith(receipt.agent)
      expect(onOpen).not.toHaveBeenCalled()
      view.rerender(<AgentLauncher project={project} onOpen={onOpen} />)
      fireEvent.click(await screen.findByRole('button', { name: 'Open Agent' }))
      expect(onOpen).toHaveBeenCalledWith({ type: 'agent', agentId: receipt.agent.id })
    },
  )

  it('preserves recovery and requires an explicit new start after partial creation', async () => {
    mocks.launch.mockRejectedValue(
      new AgentClientError('agent_launch_unavailable', 'Agent is blocked.', {
        phase: 'agent_ready',
        workspaceId: 'workspace-1',
        paneId: 'w1:p1',
        terminalId: 'terminal-1',
        agentId: 'terminal-1',
        attachCommand: 'herdr terminal attach terminal-1',
      }),
    )
    const onOpen = vi.fn()
    render(<AgentLauncher project={project} onOpen={onOpen} />)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Open Codex' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('kept for recovery')
    expect(screen.getByRole('button', { name: 'Open Codex' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Copy attach' }))
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'herdr terminal attach terminal-1',
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open Agent' }))
    expect(onOpen).toHaveBeenCalledWith({ type: 'agent', agentId: 'terminal-1' })
    fireEvent.click(screen.getByRole('button', { name: 'Start another Agent' }))
    await ready()
    expect(mocks.launch).toHaveBeenCalledTimes(1)
  })

  it('keeps the provider but resets the directory when the project changes', async () => {
    const view = render(<AgentLauncher project={project} onOpen={vi.fn()} />)
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Working directory' }))
    fireEvent.click(screen.getByRole('option', { name: /linked-task/ }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Agent provider' }), {
      target: { value: 'claude' },
    })
    mocks.directories.mockResolvedValue({ items: [{ ...primary, path: '/other' }] })
    view.rerender(<AgentLauncher project={{ name: 'other', path: '/other' }} onOpen={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open Claude' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Open Claude' }))
    await waitFor(() =>
      expect(mocks.launch).toHaveBeenCalledWith({
        projectName: 'other',
        provider: 'claude',
        workspaceId: 'primary',
      }),
    )
  })

  it('keeps the displayed directory and launch target in sync after a previous project retry', async () => {
    const retry = Promise.withResolvers<{ items: (typeof primary)[] }>()
    mocks.directories
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockReturnValueOnce(retry.promise)
      .mockResolvedValueOnce({ items: [{ ...primary, name: 'other', path: '/other' }] })
    const onOpen = vi.fn()
    const view = render(<AgentLauncher project={project} onOpen={onOpen} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Retry directories' }))
    view.rerender(<AgentLauncher project={{ name: 'other', path: '/other' }} onOpen={onOpen} />)
    await ready()
    await act(async () => retry.resolve({ items: [primary, task] }))
    expect(screen.getByText('/other')).toBeVisible()
    expect(screen.queryByText(project.path)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open Codex' }))
    await waitFor(() =>
      expect(mocks.launch).toHaveBeenCalledWith({
        projectName: 'other',
        provider: 'codex',
        workspaceId: 'primary',
      }),
    )
    await waitFor(() => expect(onOpen).toHaveBeenCalled())
  })

  it('requires an explicit directory choice when the selected worktree disappears', async () => {
    const onOpen = vi.fn()
    const launcher = (visible: boolean) => (
      <Activity mode={visible ? 'visible' : 'hidden'}>
        <AgentLauncher project={project} onOpen={onOpen} visible={visible} />
      </Activity>
    )
    const view = render(launcher(true))
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Working directory' }))
    fireEvent.click(screen.getByRole('option', { name: /linked-task/ }))
    view.rerender(launcher(false))
    mocks.directories.mockResolvedValue({ items: [primary] })
    view.rerender(launcher(true))
    await screen.findByText('Selected directory is unavailable. Choose another directory.')
    expect(screen.getByRole('button', { name: 'Open Codex' })).toBeDisabled()
    const directory = screen.getByRole('button', { name: 'Working directory' })
    expect(directory).toHaveTextContent('Choose a directory')
    fireEvent.click(directory)
    const root = screen.getByRole('option', { name: /herdr-roam/ })
    expect(root).toHaveAttribute('aria-selected', 'false')
    await waitFor(() => expect(root).toHaveFocus())
    expect(mocks.launch).not.toHaveBeenCalled()
    fireEvent.click(root)
    await ready()
    expect(screen.getByText(project.path)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Open Codex' }))
    await waitFor(() =>
      expect(mocks.launch).toHaveBeenCalledWith({
        projectName: project.name,
        provider: 'codex',
        workspaceId: 'primary',
      }),
    )
    await waitFor(() => expect(onOpen).toHaveBeenCalled())
  })

  it('requires a reliable directory catalog and runtime before opening', async () => {
    mocks.directories.mockRejectedValueOnce(new Error('directory read failed'))
    render(<AgentLauncher project={project} onOpen={vi.fn()} />)
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: 'Open Codex' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Retry directories' }))
    await ready()
    mocks.runtimeConnected = false
    fireEvent.change(screen.getByRole('combobox', { name: 'Agent provider' }), {
      target: { value: 'claude' },
    })
    expect(screen.getByRole('button', { name: 'Open Claude' })).toBeDisabled()
    expect(mocks.launch).not.toHaveBeenCalled()
  })
})
