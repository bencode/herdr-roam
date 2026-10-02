import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { AssistantPanel } from '.'
import { useAssistantStore } from './store'

type Agent = {
  id: string
  name: string
  provider: string
  status: 'idle' | 'blocked' | 'working'
  cwd: string | null
  attachTarget: string
  session: null
}

const agent = (id: string, name: string): Agent => ({
  id,
  name,
  provider: 'claude',
  status: 'idle',
  cwd: '/work/app',
  attachTarget: `${id}:p1`,
  session: null,
})

const mocks = vi.hoisted(() => ({ agents: [] as Agent[], stop: vi.fn() }))

vi.mock('../agent/runtime-provider', () => ({
  useAgentRuntime: () => ({
    snapshot: {
      source: { state: 'connected' as const, version: '0.8.2', protocol: 20 },
      stale: false,
      items: mocks.agents,
    },
    agentById: (id: string) => mocks.agents.find(item => item.id === id),
    registerStartedAgent: vi.fn(),
  }),
}))
vi.mock('../agent/client', async importOriginal => ({
  ...(await importOriginal<typeof import('../agent/client')>()),
  stopAgent: mocks.stop,
}))
vi.mock('../agent/browser-terminal', () => ({
  BrowserTerminal: ({ agentId }: { readonly agentId: string }) => (
    <section aria-label="Agent terminal">{agentId}</section>
  ),
}))

const renderPanel = () =>
  render(<AssistantPanel projectName="app" projects={[]} onOpen={() => undefined} />)

afterEach(() => {
  mocks.agents = []
  act(() => {
    const { agentIds, closeAgent } = useAssistantStore.getState()
    for (const id of agentIds) closeAgent(id)
  })
})

describe('Assistant panel', () => {
  it('keeps one tab per opened Agent and connects only the active Terminal', async () => {
    mocks.agents = [agent('agent-1', 'reviewer'), agent('agent-2', 'writer')]
    act(() => {
      useAssistantStore.getState().openAgent('agent-1')
      useAssistantStore.getState().openAgent('agent-2')
    })
    renderPanel()

    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['reviewer', 'writer'])
    expect(await screen.findAllByRole('region', { name: 'Agent terminal' })).toHaveLength(1)
    expect(screen.getByRole('region', { name: 'Agent terminal' })).toHaveTextContent('agent-2')

    fireEvent.click(screen.getByRole('tab', { name: /reviewer/ }))
    expect(await screen.findByRole('region', { name: 'Agent terminal' })).toHaveTextContent(
      'agent-1',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Close reviewer' }))
    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['writer'])
    expect(await screen.findByRole('region', { name: 'Agent terminal' })).toHaveTextContent(
      'agent-2',
    )
    expect(mocks.stop).not.toHaveBeenCalled()
  })

  it('removes background tabs for Agents that are no longer running', () => {
    mocks.agents = [agent('agent-1', 'reviewer'), agent('agent-2', 'writer')]
    act(() => {
      useAssistantStore.getState().openAgent('agent-1')
      useAssistantStore.getState().openAgent('agent-2')
    })
    const view = renderPanel()

    mocks.agents = []
    view.rerender(<AssistantPanel projectName="app" projects={[]} onOpen={() => undefined} />)

    expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual(['writer'])
    expect(useAssistantStore.getState().activeAgentId).toBe('agent-2')
  })
})
