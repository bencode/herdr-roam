import { render, screen, within } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { AssistantPanel } from '.'

type Agent = {
  id: string
  name: string
  provider: string
  status: 'idle' | 'blocked' | 'working'
  cwd: string | null
  attachTarget: string
  session: null
}

const mocks = vi.hoisted(() => ({ agents: [] as Agent[] }))

vi.mock('../agent/runtime-provider', () => ({
  useAgentRuntime: () => ({
    snapshot: {
      source: { state: 'connected' as const, version: '0.8.2', protocol: 20 },
      stale: false,
      items: mocks.agents,
    },
  }),
}))
vi.mock('../agent/browser-terminal', () => ({
  BrowserTerminal: ({ agentId }: { readonly agentId: string }) => (
    <section aria-label="Agent terminal">{agentId}</section>
  ),
}))
vi.mock('../project/workspace-client', () => ({
  fetchProjectWorkspaces: vi.fn(async () => ({
    items: [{ id: 'primary', name: 'app', path: '/work/app', kind: 'primary', primary: true }],
  })),
  WorkspaceClientError: class WorkspaceClientError extends Error {},
}))

const agent = (overrides: Partial<Agent>): Agent => ({
  id: 'agent-1',
  name: 'reviewer',
  provider: 'claude',
  status: 'idle',
  cwd: '/work/app',
  attachTarget: 'pane-1',
  session: null,
  ...overrides,
})

afterEach(() => {
  mocks.agents = []
  globalThis.localStorage.clear()
})

describe('Assistant panel', () => {
  it('opens the Terminal of the only Agent running in the Project', async () => {
    mocks.agents = [
      agent({}),
      agent({ id: 'agent-2', name: 'sibling', cwd: '/work/application' }),
      agent({ id: 'agent-3', name: 'detached', cwd: null }),
    ]
    render(<AssistantPanel projectName="app" />)

    const picker = await screen.findByRole('combobox', { name: 'Assistant Agent' })
    expect(
      within(picker)
        .getAllByRole('option')
        .map(option => option.textContent),
    ).toEqual(['reviewer · claude (idle)'])
    expect(await screen.findByRole('region', { name: 'Agent terminal' })).toHaveTextContent(
      'agent-1',
    )
  })
})
