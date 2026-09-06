import type { AgentStatus, ProjectWorkspaceCatalog } from '@herdr-roam/shared'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  stop: vi.fn(),
  directories: vi.fn(),
  present: true,
  agent: {
    id: 'terminal-1',
    name: 'codex-product',
    provider: 'codex',
    status: 'idle' as AgentStatus,
    cwd: '/work/herdr-roam' as string | null,
    attachTarget: 'w1:p1',
    session: null as null | {
      source: string
      agent: 'codex'
      kind: 'id'
      value: string
    },
  },
}))

vi.mock('../client', () => ({
  stopAgent: mocks.stop,
}))
vi.mock('../runtime-provider', () => ({
  useAgentRuntime: () => ({
    snapshot: {
      source: { state: 'connected', version: '0.8.2', protocol: 20 },
      stale: false,
      items: mocks.present ? [mocks.agent] : [],
    },
    transportError: null,
    agentById: (id: string) => (mocks.present && id === mocks.agent.id ? mocks.agent : undefined),
  }),
}))

vi.mock('../../project/workspace-client', async importOriginal => ({
  ...(await importOriginal<typeof import('../../project/workspace-client')>()),
  fetchProjectWorkspaces: mocks.directories,
}))

vi.mock('../browser-terminal', () => ({
  BrowserTerminal: ({ available }: { available: boolean }) => (
    <section aria-label="Agent terminal" aria-disabled={!available}>
      Native terminal screen
    </section>
  ),
}))

import { AgentTab } from '.'

describe('Agent terminal page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.agent.status = 'idle'
    mocks.agent.cwd = '/work/herdr-roam'
    mocks.agent.session = null
    mocks.present = true
    mocks.stop.mockResolvedValue({ agentId: 'terminal-1' })
    mocks.directories.mockResolvedValue({
      items: [
        {
          id: 'primary',
          name: 'herdr-roam',
          path: '/work/herdr-roam',
          kind: 'worktree',
          branch: 'main',
          primary: true,
        },
      ],
    })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })
  afterEach(() => vi.restoreAllMocks())

  it('opens the owning Session from an external worktree without navigating automatically', async () => {
    mocks.agent.cwd = '/tmp/linked-task/src'
    mocks.agent.session = { source: 'process', agent: 'codex', kind: 'id', value: 'session-1' }
    mocks.directories.mockResolvedValue({
      items: [
        {
          id: 'task',
          name: 'linked-task',
          path: '/tmp/linked-task',
          kind: 'worktree',
          branch: 'task',
          primary: false,
        },
      ],
    })
    const onOpen = vi.fn()
    render(
      <AgentTab
        resource={{ type: 'agent', agentId: 'terminal-1' }}
        projects={[{ name: 'herdr-roam', path: '/work/herdr-roam' }]}
        onOpen={onOpen}
      />,
    )
    const openSession = await screen.findByRole('button', { name: 'Open Session' })
    expect(onOpen).not.toHaveBeenCalled()
    fireEvent.click(openSession)
    expect(onOpen).toHaveBeenCalledWith({
      type: 'session',
      projectName: 'herdr-roam',
      provider: 'codex',
      sessionId: 'session-1',
    })
  })

  it('keeps a valid Session link when another project fails and clears the warning after retry', async () => {
    const projects = [
      { name: 'herdr-roam', path: '/work/herdr-roam' },
      { name: 'unavailable', path: '/work/unavailable' },
    ]
    const validCatalog: ProjectWorkspaceCatalog = await mocks.directories()
    const error = new Error('directory removed')
    mocks.agent.session = { source: 'process', agent: 'codex', kind: 'id', value: 'session-1' }
    mocks.directories.mockImplementation(async name => {
      if (name === 'unavailable') throw error
      return validCatalog
    })
    const onOpen = vi.fn()
    render(
      <AgentTab
        resource={{ type: 'agent', agentId: 'terminal-1' }}
        projects={projects}
        onOpen={onOpen}
      />,
    )
    const open = await screen.findByRole('button', { name: 'Open Session' })
    expect(screen.getByText('Some project directories could not be loaded.')).toBeVisible()
    expect(await screen.findByRole('region', { name: 'Agent terminal' })).toBeVisible()
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('unavailable'), error)
    expect(onOpen).not.toHaveBeenCalled()
    fireEvent.click(open)
    expect(onOpen).toHaveBeenCalledWith({
      type: 'session',
      projectName: 'herdr-roam',
      provider: 'codex',
      sessionId: 'session-1',
    })
    mocks.directories.mockImplementation(async name =>
      name === 'unavailable' ? { items: [] } : validCatalog,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry Session link' }))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Retry Session link' })).not.toBeInTheDocument(),
    )
    expect(await screen.findByRole('button', { name: 'Open Session' })).toBeVisible()
  })

  it('keeps input usable when Session directory lookup fails and supports retry', async () => {
    mocks.agent.session = { source: 'process', agent: 'codex', kind: 'id', value: 'session-1' }
    mocks.directories.mockRejectedValueOnce(new Error('directory listing failed'))
    render(
      <AgentTab
        resource={{ type: 'agent', agentId: 'terminal-1' }}
        projects={[{ name: 'herdr-roam', path: '/work/herdr-roam' }]}
      />,
    )
    const retry = await screen.findByRole('button', { name: 'Retry Session link' })
    expect(await screen.findByRole('region', { name: 'Agent terminal' })).toBeVisible()
    fireEvent.click(retry)
    expect(await screen.findByRole('button', { name: 'Open Session' })).toBeVisible()
  })

  it('only mounts the terminal for the active Agent resource', async () => {
    const props = { resource: { type: 'agent' as const, agentId: 'terminal-1' } }
    const { rerender } = render(<AgentTab {...props} active={false} />)
    expect(screen.queryByRole('region', { name: 'Agent terminal' })).not.toBeInTheDocument()
    rerender(<AgentTab {...props} active />)
    expect(await screen.findByRole('region', { name: 'Agent terminal' })).toBeVisible()
    rerender(<AgentTab {...props} active={false} />)
    expect(screen.queryByRole('region', { name: 'Agent terminal' })).not.toBeInTheDocument()
    rerender(<AgentTab {...props} active />)
    expect(await screen.findByRole('region', { name: 'Agent terminal' })).toBeVisible()
  })

  it('shows the native terminal and copies the attach command', async () => {
    render(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)
    expect(await screen.findByRole('region', { name: 'Agent terminal' })).toBeVisible()
    expect(screen.getByText('/work/herdr-roam')).toBeVisible()
    expect(screen.getByRole('region', { name: 'Agent terminal' })).toBeVisible()
    expect(screen.queryByText('Live output')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Copy attach command' }))
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('herdr agent attach w1:p1'),
    )
  })

  it('reveals Agent details only when requested', async () => {
    render(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)
    expect(await screen.findByRole('region', { name: 'Agent terminal' })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Agent details' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Show Agent details' }))
    expect(screen.getByRole('heading', { name: 'Agent details' })).toBeVisible()
    expect(screen.getByText('Working directory')).toBeVisible()
    expect(screen.getByText('Attach target')).toBeVisible()
    expect(screen.getAllByText('/work/herdr-roam')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', { name: 'Copy working directory' }))
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/work/herdr-roam'),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close Agent details' }))
    expect(screen.queryByRole('heading', { name: 'Agent details' })).not.toBeInTheDocument()
  })

  it('handles a missing working directory', async () => {
    mocks.agent.cwd = null
    render(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)
    expect(await screen.findByRole('region', { name: 'Agent terminal' })).toBeVisible()
    expect(screen.getByText('Working directory unavailable')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Show Agent details' }))
    expect(screen.getByText('Unavailable')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Copy working directory' })).not.toBeInTheDocument()
  })

  it('uses Terminal for blocked Agents without another mode or composer', async () => {
    mocks.agent.status = 'blocked'
    render(<AgentTab resource={{ type: 'agent', agentId: 'terminal-1' }} />)
    expect(await screen.findByRole('region', { name: 'Agent terminal' })).toBeVisible()
    expect(screen.queryByRole('textbox', { name: 'Send a Prompt' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^(Preview|Terminal|Back to Preview|Open Terminal)$/ }),
    ).not.toBeInTheDocument()
  })

  it('stops a Session-linked Agent and opens its History after removal', async () => {
    mocks.agent.session = {
      source: 'process',
      agent: 'codex',
      kind: 'id',
      value: 'session-1',
    }
    const onOpen = vi.fn()
    const props = {
      resource: { type: 'agent' as const, agentId: 'terminal-1' },
      projects: [{ name: 'herdr-roam', path: '/work/herdr-roam' }],
      onOpen,
    }
    const { rerender } = render(<AgentTab {...props} />)
    expect(await screen.findByRole('region', { name: 'Agent terminal' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Stop Agent…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm stop' }))
    await waitFor(() => expect(mocks.stop).toHaveBeenCalledWith('terminal-1'))
    expect(onOpen).not.toHaveBeenCalled()

    mocks.present = false
    rerender(<AgentTab {...props} />)
    await waitFor(() =>
      expect(onOpen).toHaveBeenCalledWith({
        type: 'session',
        projectName: 'herdr-roam',
        provider: 'codex',
        sessionId: 'session-1',
      }),
    )
  })

  it('stops an unlinked Agent and keeps its last output visible', async () => {
    const onOpen = vi.fn()
    const props = {
      resource: { type: 'agent' as const, agentId: 'terminal-1' },
      onOpen,
    }
    const { rerender } = render(<AgentTab {...props} />)
    expect(await screen.findByRole('region', { name: 'Agent terminal' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Stop Agent…' }))
    expect(screen.queryByText(/Session history stays available/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm stop' }))
    await waitFor(() => expect(mocks.stop).toHaveBeenCalledWith('terminal-1'))

    mocks.present = false
    rerender(<AgentTab {...props} />)

    expect(await screen.findByText('stopped')).toBeVisible()
    expect(screen.getByRole('region', { name: 'Agent terminal' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    expect(
      screen.getAllByText('This Agent has stopped and is no longer present in Herdr.')[0],
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Stop Agent…' })).not.toBeInTheDocument()
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('keeps a linked Agent open when stopping fails', async () => {
    mocks.agent.session = {
      source: 'process',
      agent: 'codex',
      kind: 'id',
      value: 'session-1',
    }
    mocks.stop.mockRejectedValue(new Error('The pane could not be closed.'))
    const onOpen = vi.fn()
    render(
      <AgentTab
        resource={{ type: 'agent', agentId: 'terminal-1' }}
        projects={[{ name: 'herdr-roam', path: '/work/herdr-roam' }]}
        onOpen={onOpen}
      />,
    )
    expect(await screen.findByRole('region', { name: 'Agent terminal' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Stop Agent…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm stop' }))

    expect(await screen.findByText('The pane could not be closed.')).toBeVisible()
    expect(onOpen).not.toHaveBeenCalled()
    expect(screen.getByRole('region', { name: 'Agent terminal' })).toBeVisible()
  })
})
