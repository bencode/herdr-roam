import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, vi } from 'vitest'
import { formatElapsed } from '../agent/presentation'
import { useAssistantStore } from '../assistant/store'
import { AgentsBoard } from '.'

type Agent = {
  id: string
  name: string
  provider: string
  status: 'blocked' | 'working' | 'idle' | 'done'
  cwd: string
  attachTarget: string
  session: null
}

const agent = (id: string, status: Agent['status']): Agent => ({
  id,
  name: id,
  provider: 'claude',
  status,
  cwd: `/work/${id}`,
  attachTarget: `${id}:p1`,
  session: null,
})

const mocks = vi.hoisted(() => ({ agents: [] as Agent[], input: vi.fn() }))

vi.mock('../agent/runtime-provider', () => ({
  useAgentRuntime: () => ({
    snapshot: {
      source: { state: 'connected' as const, version: '0.8.2', protocol: 20 },
      stale: false,
      items: mocks.agents,
      statusSince: {},
    },
  }),
}))
vi.mock('../agent/client', async importOriginal => ({
  ...(await importOriginal<typeof import('../agent/client')>()),
  sendAgentInput: mocks.input,
}))
vi.mock('./terminal-preview', () => ({ TerminalPreview: () => null }))

afterEach(() => {
  mocks.agents = []
  mocks.input.mockReset()
  act(() => {
    const { agentIds, closeAgent } = useAssistantStore.getState()
    for (const id of agentIds) closeAgent(id)
  })
})

const sectionNames = () =>
  screen.getAllByRole('region').map(region => region.getAttribute('aria-label'))

describe('Agents board', () => {
  it('puts blocked Agents first and filters by status chips', () => {
    mocks.agents = [agent('web', 'working'), agent('api', 'blocked'), agent('docs', 'idle')]
    render(<AgentsBoard />)

    expect(sectionNames()).toEqual(['Blocked', 'Working', 'Idle · Done'])
    fireEvent.click(screen.getByRole('button', { name: /Working\s*1/ }))
    expect(sectionNames()).toEqual(['Working'])
    expect(screen.getByRole('article', { name: 'web' })).toBeVisible()
  })

  it('answers a blocked Agent with explicit keys and opens it in the panel', async () => {
    mocks.agents = [agent('api', 'blocked'), agent('web', 'working')]
    mocks.input.mockResolvedValue(undefined)
    render(<AgentsBoard />)

    const card = screen.getByRole('article', { name: 'api' })
    fireEvent.click(within(card).getByRole('button', { name: 'Accept' }))
    await waitFor(() =>
      expect(mocks.input).toHaveBeenCalledWith('api', { type: 'keys', keys: ['enter'] }),
    )
    fireEvent.click(within(card).getByRole('button', { name: 'Open' }))
    expect(useAssistantStore.getState().activeAgentId).toBe('api')
    expect(
      within(screen.getByRole('article', { name: 'web' })).queryByRole('button', {
        name: 'Accept',
      }),
    ).not.toBeInTheDocument()
  })

  it('cycles through blocked Agents', () => {
    mocks.agents = [agent('b-two', 'blocked'), agent('a-one', 'blocked')]
    render(<AgentsBoard />)

    const next = screen.getByRole('button', { name: 'Next blocked →' })
    fireEvent.click(next)
    expect(useAssistantStore.getState().activeAgentId).toBe('a-one')
    fireEvent.click(next)
    expect(useAssistantStore.getState().activeAgentId).toBe('b-two')
    fireEvent.click(next)
    expect(useAssistantStore.getState().activeAgentId).toBe('a-one')
  })

  it('formats observed status durations', () => {
    const since = '2026-10-02T10:00:00.000Z'
    const at = (seconds: number) => Date.parse(since) + seconds * 1000
    expect(formatElapsed(since, at(42))).toBe('42s')
    expect(formatElapsed(since, at(60 * 59))).toBe('59m')
    expect(formatElapsed(since, at(60 * 61))).toBe('1h 1m')
    expect(formatElapsed(undefined, at(0))).toBeNull()
  })
})
