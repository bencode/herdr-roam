import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import type { ResourceRef } from '../../../workbench/resource'
import { SessionClientError } from '../client'
import { SessionTab } from '.'

const mocks = vi.hoisted(() => ({
  resume: vi.fn(),
  stop: vi.fn(),
  reload: vi.fn(),
  agents: [] as Array<{
    id: string
    name: string
    provider: string
    status: 'idle' | 'blocked'
    cwd: string
    attachTarget: string
    session: { source: string; agent: string; kind: 'id'; value: string }
  }>,
}))

vi.mock('../client', async () => ({
  ...(await vi.importActual<typeof import('../client')>('../client')),
  resumeSession: mocks.resume,
}))
vi.mock('../use-session-data', () => ({
  useSessionData: () => ({
    value: {
      id: 'session-1',
      provider: 'codex',
      title: 'Review release',
      cwd: '/work/herdr-roam',
      createdAt: null,
      updatedAt: '2026-09-01T09:00:00.000Z',
      mode: 'page',
      entries: [
        {
          kind: 'message',
          id: 'message-1',
          role: 'assistant',
          text: '# Historical answer',
          createdAt: null,
          attachments: [],
        },
      ],
      olderCursor: null,
      tailCursor: 'tail-1',
      atLatest: true,
    },
    loading: false,
    error: null,
    navigation: 'initial',
    hasNewer: false,
    loadOlder: vi.fn(),
    loadNewer: vi.fn(),
    loadLatest: vi.fn(),
    reload: mocks.reload,
  }),
}))
vi.mock('../../agent/runtime-provider', () => ({
  useAgentRuntime: () => ({
    snapshot: {
      source: { state: 'connected' as const, version: '0.8.2', protocol: 20 },
      stale: false,
      items: mocks.agents,
    },
    agentById: (agentId: string) => mocks.agents.find(agent => agent.id === agentId),
  }),
}))
vi.mock('../../agent/client', () => ({
  stopAgent: mocks.stop,
}))
vi.mock('../../agent/runtime-surface', () => ({
  AgentRuntimeSurface: ({ agent }: { readonly agent: { readonly id: string } }) => (
    <div data-testid="agent-runtime-surface">{agent.id}</div>
  ),
}))

const resource = {
  type: 'session',
  projectName: 'herdr-roam',
  provider: 'codex',
  sessionId: 'session-1',
} as const

const renderSession = (
  onOpen: (resource: ResourceRef) => void = () => undefined,
  onFocusModeChange: (focused: boolean) => void = () => undefined,
) =>
  render(
    <SessionTab
      resource={resource}
      focusMode={false}
      onFocusModeChange={onFocusModeChange}
      onOpen={onOpen}
    />,
  )

describe('Session tab', () => {
  beforeEach(() => {
    mocks.agents = []
    mocks.reload.mockReset()
    mocks.resume.mockReset()
    mocks.stop.mockReset()
  })

  afterEach(() => vi.restoreAllMocks())

  it('shows history while offline and resumes through Herdr on demand', async () => {
    mocks.resume.mockResolvedValue({
      reused: false,
      agent: {
        id: 'terminal-1',
        name: 'codex-herdr-roam',
        provider: 'codex',
        status: 'idle',
        cwd: '/work/herdr-roam/.worktrees/release',
        attachTarget: 'w1:p1',
        session: { source: 'process', agent: 'codex', kind: 'id', value: 'session-1' },
      },
    })
    renderSession()

    expect(screen.getByText('Historical answer')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Historical answer', level: 2 })).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Historical answer', level: 1 })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Resume Session' }))
    await waitFor(() =>
      expect(mocks.resume).toHaveBeenCalledWith('herdr-roam', 'codex', 'session-1'),
    )
    expect(mocks.reload).toHaveBeenCalled()
    expect(screen.getByTestId('agent-runtime-surface')).toHaveTextContent('terminal-1')
    expect(screen.getByRole('button', { name: 'Live' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTitle('/work/herdr-roam/.worktrees/release')).toBeVisible()
  })

  it('keeps Resume failures visible and exposes recovery actions', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    mocks.resume.mockRejectedValue(
      new SessionClientError('session_resume_unavailable', 'Agent startup timed out.', {
        phase: 'agent_ready',
        workspaceId: 'w2',
        paneId: 'w2:p1',
        terminalId: 'terminal-2',
        agentId: 'terminal-2',
        attachCommand: 'herdr terminal attach terminal-2',
      }),
    )
    const onOpen = vi.fn<(resource: ResourceRef) => void>()
    renderSession(onOpen)

    fireEvent.click(screen.getByRole('button', { name: 'Resume Session' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Agent startup timed out.')
    fireEvent.click(screen.getByRole('button', { name: 'Open Agent' }))
    expect(onOpen).toHaveBeenCalledWith({ type: 'agent', agentId: 'terminal-2' })
    fireEvent.click(screen.getByRole('button', { name: 'Copy attach' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('herdr terminal attach terminal-2'))

    mocks.resume.mockImplementation(() => new Promise(() => undefined))
    fireEvent.click(screen.getByRole('button', { name: 'Resume Session' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('uses the shared composer and opens the linked live Agent', () => {
    mocks.agents = [
      {
        id: 'terminal-1',
        name: 'codex-herdr-roam',
        provider: 'codex',
        status: 'idle',
        cwd: '/work/herdr-roam',
        attachTarget: 'w1:p1',
        session: { source: 'process', agent: 'codex', kind: 'id', value: 'session-1' },
      },
    ]
    const onOpen = vi.fn<(resource: ResourceRef) => void>()
    renderSession(onOpen)

    expect(screen.getByTestId('agent-runtime-surface')).toHaveTextContent('terminal-1')
    fireEvent.click(screen.getByRole('button', { name: 'Open Agent' }))
    expect(onOpen).toHaveBeenCalledWith({ type: 'agent', agentId: 'terminal-1' })
  })

  it('keeps an explicit History selection while the Agent remains available', () => {
    mocks.agents = [
      {
        id: 'terminal-1',
        name: 'codex-herdr-roam',
        provider: 'codex',
        status: 'idle',
        cwd: '/work/herdr-roam',
        attachTarget: 'w1:p1',
        session: { source: 'process', agent: 'codex', kind: 'id', value: 'session-1' },
      },
    ]
    const { rerender } = renderSession()
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(screen.getByText('Historical answer')).toBeVisible()

    rerender(
      <SessionTab
        resource={resource}
        focusMode={false}
        onFocusModeChange={() => undefined}
        onOpen={() => undefined}
      />,
    )
    expect(screen.getByRole('button', { name: 'History' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('returns to History when the matching live Agent disappears', async () => {
    mocks.agents = [
      {
        id: 'terminal-1',
        name: 'codex-herdr-roam',
        provider: 'codex',
        status: 'idle',
        cwd: '/work/herdr-roam',
        attachTarget: 'w1:p1',
        session: { source: 'process', agent: 'codex', kind: 'id', value: 'session-1' },
      },
    ]
    const { rerender } = renderSession()
    expect(screen.getByRole('button', { name: 'Live' })).toHaveAttribute('aria-pressed', 'true')

    mocks.agents = []
    rerender(
      <SessionTab
        resource={resource}
        focusMode={false}
        onFocusModeChange={() => undefined}
        onOpen={() => undefined}
      />,
    )

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'History' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    )
    expect(screen.getByText('Historical answer')).toBeVisible()
  })

  it('stops the linked Agent and returns to resumable History after it disappears', async () => {
    mocks.stop.mockResolvedValue({ agentId: 'terminal-1' })
    mocks.agents = [
      {
        id: 'terminal-1',
        name: 'codex-herdr-roam',
        provider: 'codex',
        status: 'idle',
        cwd: '/work/herdr-roam',
        attachTarget: 'w1:p1',
        session: { source: 'process', agent: 'codex', kind: 'id', value: 'session-1' },
      },
    ]
    const { rerender } = renderSession()

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm stop' }))
    await waitFor(() => expect(mocks.stop).toHaveBeenCalledWith('terminal-1'))
    expect(screen.getByRole('button', { name: 'Stopping…' })).toBeDisabled()

    mocks.agents = []
    rerender(
      <SessionTab
        resource={resource}
        focusMode={false}
        onFocusModeChange={() => undefined}
        onOpen={() => undefined}
      />,
    )

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Resume Session' })).toBeVisible(),
    )
    expect(screen.getByRole('button', { name: 'History' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Historical answer')).toBeVisible()
    expect(mocks.reload).toHaveBeenCalled()
  })

  it('keeps the live Session visible when stopping fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    mocks.stop.mockRejectedValue(new Error('The pane could not be closed.'))
    mocks.agents = [
      {
        id: 'terminal-1',
        name: 'codex-herdr-roam',
        provider: 'codex',
        status: 'idle',
        cwd: '/work/herdr-roam',
        attachTarget: 'w1:p1',
        session: { source: 'process', agent: 'codex', kind: 'id', value: 'session-1' },
      },
    ]
    renderSession()

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm stop' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The pane could not be closed.')
    expect(screen.getByTestId('agent-runtime-surface')).toHaveTextContent('terminal-1')
    expect(screen.getByRole('button', { name: 'Live' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('delegates focus mode ownership to the shell', () => {
    const onFocusModeChange = vi.fn()
    renderSession(() => undefined, onFocusModeChange)

    fireEvent.click(screen.getByRole('button', { name: 'Enter focus mode' }))
    expect(onFocusModeChange).toHaveBeenCalledWith(true)
  })
})
