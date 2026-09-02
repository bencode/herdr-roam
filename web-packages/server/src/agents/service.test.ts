import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  discover: vi.fn(),
  listAgents: vi.fn(),
  readAgent: vi.fn(),
  promptAgent: vi.fn(),
  sendAgentKeys: vi.fn(),
  sendPaneInput: vi.fn(),
  focusAgent: vi.fn(),
  closePane: vi.fn(),
  subscribe: vi.fn(),
  stagePromptImages: vi.fn(),
  event: null as (() => void) | null,
  disconnect: null as ((error: Error) => void) | null,
}))

vi.mock('./images.js', async importOriginal => {
  const original = await importOriginal<typeof import('./images.js')>()
  return { ...original, stagePromptImages: mocks.stagePromptImages }
})

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
      readAgent: mocks.readAgent,
      promptAgent: mocks.promptAgent,
      sendAgentKeys: mocks.sendAgentKeys,
      sendPaneInput: mocks.sendPaneInput,
      focusAgent: mocks.focusAgent,
      closePane: mocks.closePane,
      createWorkspace: vi.fn(),
      startAgent: vi.fn(),
      getAgent: vi.fn(),
      subscribe: mocks.subscribe,
    }),
  }
})

import { createAgentService } from './service.js'

const detectedAgent = (agentStatus: 'blocked' | 'done' | 'idle' | 'working' = 'working') => ({
  terminal_id: 'terminal-1',
  agent_status: agentStatus,
  workspace_id: 'w1',
  tab_id: 't1',
  pane_id: 'w1:p1',
  name: 'codex-product',
})

describe('Agent service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.discover.mockResolvedValue({
      socketPath: '/tmp/herdr.sock',
      version: '0.8.2',
      protocol: 20,
    })
    mocks.listAgents.mockResolvedValue([detectedAgent()])
    mocks.subscribe.mockImplementation(
      (onEvent: () => void, onDisconnect: (error: Error) => void) => {
        mocks.event = onEvent
        mocks.disconnect = onDisconnect
        return Promise.resolve(() => undefined)
      },
    )
    mocks.promptAgent.mockResolvedValue(undefined)
    mocks.readAgent.mockResolvedValue('recent output')
    mocks.sendAgentKeys.mockResolvedValue(undefined)
    mocks.sendPaneInput.mockResolvedValue(undefined)
    mocks.focusAgent.mockResolvedValue(undefined)
    mocks.closePane.mockResolvedValue(undefined)
    mocks.stagePromptImages.mockResolvedValue(['/tmp/prompt-image.png'])
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

  it('bounds recent Agent output without splitting UTF-8 text', async () => {
    const service = createAgentService()
    service.start()
    await vi.waitFor(() => expect(service.snapshot().source.state).toBe('connected'))

    await expect(service.output('terminal-1')).resolves.toEqual({
      text: 'recent output',
      truncated: false,
    })
    expect(mocks.readAgent).toHaveBeenCalledWith('w1:p1', 500)

    mocks.readAgent.mockResolvedValue(`discarded\n${'中'.repeat(200_000)}`)
    const truncated = await service.output('terminal-1')
    expect(truncated.truncated).toBe(true)
    expect(Buffer.byteLength(truncated.text, 'utf8')).toBeLessThanOrEqual(512 * 1024)
    expect(truncated.text.startsWith('\u001b[0m')).toBe(true)
    expect(truncated.text.slice(4)).toMatch(/^中+$/)
    service.stop()
  })

  it('stops only the Pane attached to the requested Agent', async () => {
    const service = createAgentService()
    service.start()
    await vi.waitFor(() => expect(service.snapshot().source.state).toBe('connected'))

    await expect(service.stopAgent('terminal-1')).resolves.toBeUndefined()
    expect(mocks.closePane).toHaveBeenCalledWith('w1:p1')
    service.stop()
  })

  it('reports an observable error when the Agent Pane cannot be closed', async () => {
    mocks.closePane.mockRejectedValueOnce(new Error('socket closed'))
    const service = createAgentService()
    service.start()
    await vi.waitFor(() => expect(service.snapshot().source.state).toBe('connected'))

    await expect(service.stopAgent('terminal-1')).rejects.toMatchObject({
      code: 'agent_stop_unavailable',
      message: 'The Agent could not be stopped.',
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

  it.each(['idle', 'done', 'working'] as const)(
    'submits Prompts when the Agent is %s',
    async status => {
      mocks.listAgents.mockResolvedValueOnce([detectedAgent(status)])
      const service = createAgentService()
      service.start()
      await vi.waitFor(() => expect(service.snapshot().source.state).toBe('connected'))

      await expect(
        service.prompt('terminal-1', { text: 'Review the change.', images: [] }),
      ).resolves.toBeUndefined()
      expect(mocks.promptAgent).toHaveBeenCalledWith('w1:p1', 'Review the change.')
      service.stop()
    },
  )

  it('rejects Prompts while the Agent is blocked', async () => {
    mocks.listAgents.mockResolvedValueOnce([detectedAgent('blocked')])
    const service = createAgentService()
    service.start()
    await vi.waitFor(() => expect(service.snapshot().source.state).toBe('connected'))

    await expect(
      service.prompt('terminal-1', { text: 'Continue.', images: [] }),
    ).rejects.toMatchObject({
      code: 'agent_not_ready',
    })
    expect(mocks.promptAgent).not.toHaveBeenCalled()
    service.stop()
  })

  it('pastes staged image paths before submitting Prompt text', async () => {
    const service = createAgentService()
    service.start()
    await vi.waitFor(() => expect(service.snapshot().source.state).toBe('connected'))
    const image = {
      bytes: new Uint8Array([1]),
      type: 'image/png' as const,
      extension: 'png' as const,
    }

    await expect(
      service.prompt('terminal-1', { text: 'Inspect this.', images: [image] }),
    ).resolves.toBeUndefined()
    expect(mocks.stagePromptImages).toHaveBeenCalledWith([image])
    expect(mocks.sendPaneInput).toHaveBeenCalledWith('w1:p1', '/tmp/prompt-image.png', [])
    expect(mocks.promptAgent).toHaveBeenCalledWith('w1:p1', 'Inspect this.')
    expect(mocks.sendPaneInput.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.promptAgent.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    )
    service.stop()
  })

  it('submits an image-only Prompt and forwards Shift+Tab without provider logic', async () => {
    const service = createAgentService()
    service.start()
    await vi.waitFor(() => expect(service.snapshot().source.state).toBe('connected'))
    const image = {
      bytes: new Uint8Array([1]),
      type: 'image/png' as const,
      extension: 'png' as const,
    }

    await expect(
      service.prompt('terminal-1', { text: '', images: [image] }),
    ).resolves.toBeUndefined()
    expect(mocks.sendAgentKeys).toHaveBeenCalledWith('w1:p1', ['enter'])

    await expect(
      service.input('terminal-1', { type: 'keys', keys: ['shift+tab'] }),
    ).resolves.toBeUndefined()
    expect(mocks.sendAgentKeys).toHaveBeenLastCalledWith('w1:p1', ['shift+tab'])
    service.stop()
  })

  it('reports an inspectable error after image input partially fails', async () => {
    mocks.sendPaneInput.mockRejectedValueOnce(new Error('socket closed'))
    const service = createAgentService()
    service.start()
    await vi.waitFor(() => expect(service.snapshot().source.state).toBe('connected'))

    await expect(
      service.prompt('terminal-1', {
        text: 'Inspect this.',
        images: [{ bytes: new Uint8Array([1]), type: 'image/png', extension: 'png' }],
      }),
    ).rejects.toMatchObject({
      code: 'agent_prompt_unavailable',
      message: expect.stringContaining('native composer'),
    })
    service.stop()
  })

  it('forwards native key and text input while the Agent is blocked', async () => {
    mocks.listAgents.mockResolvedValueOnce([detectedAgent('blocked')])
    const service = createAgentService()
    service.start()
    await vi.waitFor(() => expect(service.snapshot().source.state).toBe('connected'))

    await expect(
      service.input('terminal-1', { type: 'keys', keys: ['down', 'enter'] }),
    ).resolves.toBeUndefined()
    await expect(
      service.input('terminal-1', { type: 'text', text: '保留现有数据。' }),
    ).resolves.toBeUndefined()
    expect(mocks.sendAgentKeys).toHaveBeenCalledWith('w1:p1', ['down', 'enter'])
    expect(mocks.sendPaneInput).toHaveBeenCalledWith('w1:p1', '保留现有数据。', [])
    service.stop()
  })

  it('allows only the native mode toggle when the Agent is not blocked', async () => {
    const service = createAgentService()
    service.start()
    await vi.waitFor(() => expect(service.snapshot().source.state).toBe('connected'))

    await expect(
      service.input('terminal-1', { type: 'keys', keys: ['shift+tab'] }),
    ).resolves.toBeUndefined()
    await expect(
      service.input('terminal-1', { type: 'keys', keys: ['enter'] }),
    ).rejects.toMatchObject({ code: 'agent_not_ready' })
    await expect(
      service.input('terminal-1', { type: 'text', text: 'Continue.' }),
    ).rejects.toMatchObject({ code: 'agent_not_ready' })
    expect(mocks.sendAgentKeys).toHaveBeenCalledOnce()
    expect(mocks.sendAgentKeys).toHaveBeenCalledWith('w1:p1', ['shift+tab'])
    expect(mocks.sendPaneInput).not.toHaveBeenCalled()
    service.stop()
  })

  it('reports a recoverable error when blocked terminal input fails', async () => {
    mocks.listAgents.mockResolvedValueOnce([detectedAgent('blocked')])
    mocks.sendPaneInput.mockRejectedValueOnce(new Error('socket closed'))
    const service = createAgentService()
    service.start()
    await vi.waitFor(() => expect(service.snapshot().source.state).toBe('connected'))

    await expect(
      service.input('terminal-1', { type: 'text', text: 'Keep this note.' }),
    ).rejects.toMatchObject({
      code: 'agent_input_unavailable',
      message: 'The Agent input could not be sent.',
    })
    service.stop()
  })

  it('focuses the live Agent through its Pane target', async () => {
    const service = createAgentService()
    service.start()
    await vi.waitFor(() => expect(service.snapshot().source.state).toBe('connected'))

    await expect(service.focus('terminal-1')).resolves.toBeUndefined()
    expect(mocks.focusAgent).toHaveBeenCalledWith('w1:p1')
    service.stop()
  })
})
