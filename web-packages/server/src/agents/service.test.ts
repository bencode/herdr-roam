import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  discover: vi.fn(),
  listAgents: vi.fn(),
  listPanes: vi.fn(),
  readAgent: vi.fn(),
  promptAgent: vi.fn(),
  subscribe: vi.fn(),
  event: null as (() => void) | null,
  disconnect: null as ((error: Error) => void) | null,
}))

vi.mock('../herdr/discovery.js', async importOriginal => {
  const original = await importOriginal<typeof import('../herdr/discovery.js')>()
  return { ...original, discoverHerdr: mocks.discover }
})

vi.mock('../herdr/client.js', async importOriginal => {
  const original = await importOriginal<typeof import('../herdr/client.js')>()
  return {
    ...original,
    createHerdrClient: () => ({
      listAgents: mocks.listAgents,
      listPanes: mocks.listPanes,
      readAgent: mocks.readAgent,
      promptAgent: mocks.promptAgent,
      subscribe: mocks.subscribe,
    }),
  }
})

import { createAgentService } from './service.js'

describe('Agent service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.discover.mockResolvedValue({
      socketPath: '/tmp/herdr.sock',
      version: '0.8.2',
      protocol: 20,
    })
    mocks.listAgents.mockResolvedValue([
      {
        terminal_id: 'terminal-1',
        agent_status: 'working',
        workspace_id: 'w1',
        tab_id: 't1',
        pane_id: 'w1:p1',
        name: 'codex-product',
      },
    ])
    mocks.listPanes.mockResolvedValue([
      { pane_id: 'w1:p1', cwd: '/work/herdr-roam' },
    ])
    mocks.subscribe.mockImplementation(
      (onEvent: () => void, onDisconnect: (error: Error) => void) => {
        mocks.event = onEvent
        mocks.disconnect = onDisconnect
        return Promise.resolve(() => undefined)
      },
    )
    mocks.promptAgent.mockResolvedValue(undefined)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mocks.disconnect = null
    mocks.event = null
  })

  it('subscribes before publishing the authoritative agent list', async () => {
    const service = createAgentService()
    service.start()
    await vi.waitFor(() => expect(service.snapshot().source.state).toBe('connected'))
    expect(mocks.subscribe.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.listAgents.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    )
    expect(service.snapshot().items[0]).toMatchObject({
      id: 'terminal-1',
      attachTarget: 'w1:p1',
    })
    service.stop()
  })

  it('keeps the last in-memory snapshot as stale after disconnect', async () => {
    const service = createAgentService()
    service.start()
    await vi.waitFor(() => expect(service.snapshot().source.state).toBe('connected'))
    mocks.disconnect?.(new Error('socket closed'))
    expect(service.snapshot()).toMatchObject({
      source: { state: 'reconnecting' },
      stale: true,
      items: [{ id: 'terminal-1' }],
    })
    service.stop()
  })

  it('does not broadcast duplicate snapshots during refresh', async () => {
    const service = createAgentService()
    service.start()
    await vi.waitFor(() => expect(service.snapshot().source.state).toBe('connected'))
    const listener = vi.fn()
    const unsubscribe = service.subscribe(listener)

    mocks.event?.()
    await vi.waitFor(() => expect(mocks.listAgents).toHaveBeenCalledTimes(2))
    expect(listener).not.toHaveBeenCalled()

    mocks.listAgents.mockResolvedValueOnce([])
    mocks.event?.()
    await vi.waitFor(() => expect(listener).toHaveBeenCalledTimes(1))
    expect(service.snapshot().items).toEqual([])

    unsubscribe()
    service.stop()
  })

  it.each(['idle', 'done'] as const)('submits Prompts when the Agent is %s', async status => {
    mocks.listAgents.mockResolvedValueOnce([
      {
        terminal_id: 'terminal-1',
        agent_status: status,
        workspace_id: 'w1',
        tab_id: 't1',
        pane_id: 'w1:p1',
        name: 'codex-product',
      },
    ])
    const service = createAgentService()
    service.start()
    await vi.waitFor(() => expect(service.snapshot().source.state).toBe('connected'))

    await expect(service.prompt('terminal-1', 'Review the change.')).resolves.toBeUndefined()
    expect(mocks.promptAgent).toHaveBeenCalledWith('w1:p1', 'Review the change.')
    service.stop()
  })

  it('rejects Prompts while the Agent is not ready', async () => {
    const service = createAgentService()
    service.start()
    await vi.waitFor(() => expect(service.snapshot().source.state).toBe('connected'))

    await expect(service.prompt('terminal-1', 'Continue.')).rejects.toMatchObject({
      code: 'agent_not_ready',
    })
    expect(mocks.promptAgent).not.toHaveBeenCalled()
    service.stop()
  })
})
