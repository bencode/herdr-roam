import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { AssistantPanel } from '.'

type Agent = {
  id: string
  name: string
  provider: string
  status: 'idle' | 'blocked' | 'working'
  cwd: string | null
  attachTarget: string
  session: { source: string; agent: string; kind: 'id'; value: string } | null
}

const mocks = vi.hoisted(() => ({
  agents: [] as Agent[],
  submit: vi.fn(),
}))

vi.mock('../agent/runtime-provider', () => ({
  useAgentRuntime: () => ({
    snapshot: {
      source: { state: 'connected' as const, version: '0.8.2', protocol: 20 },
      stale: false,
      items: mocks.agents,
    },
  }),
}))
vi.mock('../agent/client', () => ({ submitAgentPrompt: mocks.submit }))
vi.mock('../project/workspace-client', () => ({
  fetchProjectWorkspaces: vi.fn(async () => ({
    items: [{ id: 'primary', name: 'app', path: '/work/app', kind: 'primary', primary: true }],
  })),
  WorkspaceClientError: class WorkspaceClientError extends Error {},
}))
vi.mock('../session/use-session-data', () => ({
  useSessionData: () => ({
    value: {
      id: 'session-1',
      provider: 'claude',
      title: 'Review',
      cwd: '/work/app',
      createdAt: null,
      updatedAt: '2026-10-01T09:00:00.000Z',
      mode: 'page',
      entries: [
        {
          kind: 'message',
          id: 'message-1',
          role: 'assistant',
          text: 'The state machine is missing cancel.',
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
    reload: vi.fn(),
  }),
}))

const agent = (overrides: Partial<Agent>): Agent => ({
  id: 'agent-1',
  name: 'reviewer',
  provider: 'claude',
  status: 'idle',
  cwd: '/work/app',
  attachTarget: 'pane-1',
  session: { source: 'herdr', agent: 'claude', kind: 'id', value: 'session-1' },
  ...overrides,
})

const projects = [{ name: 'app', path: '/work/app' }]

afterEach(() => {
  mocks.agents = []
  mocks.submit.mockReset()
  globalThis.localStorage.clear()
})

describe('Assistant panel', () => {
  it('asks the only Agent running in the Project and shows its Session', async () => {
    mocks.agents = [
      agent({}),
      agent({ id: 'agent-2', name: 'sibling', cwd: '/work/application' }),
      agent({ id: 'agent-3', name: 'detached', cwd: null }),
    ]
    mocks.submit.mockResolvedValue({ agentId: 'agent-1' })
    render(<AssistantPanel projectName="app" projects={projects} />)

    const picker = await screen.findByRole('combobox', { name: 'Assistant Agent' })
    expect(
      within(picker)
        .getAllByRole('option')
        .map(option => option.textContent),
    ).toEqual(['reviewer · claude (idle)'])
    expect(await screen.findByText('The state machine is missing cancel.')).toBeVisible()

    const field = screen.getByRole('textbox', { name: 'Ask the Agent' })
    fireEvent.change(field, { target: { value: 'Is cancel handled?' } })
    fireEvent.keyDown(field, { key: 'Enter' })

    await waitFor(() => expect(mocks.submit).toHaveBeenCalledWith('agent-1', 'Is cancel handled?'))
    await waitFor(() => expect(field).toHaveValue(''))
  })

  it('does not send to a blocked Agent', async () => {
    mocks.agents = [agent({ status: 'blocked' })]
    render(<AssistantPanel projectName="app" projects={projects} />)

    const field = await screen.findByRole('textbox', { name: 'Ask the Agent' })
    expect(field).toBeDisabled()
    expect(screen.getByText('Agent is blocked. Respond in its Terminal.')).toBeVisible()
  })
})
