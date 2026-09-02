import { AGENT_TEXT_MAX_BYTES, type AgentRuntimeSnapshot } from '@herdr-roam/shared'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectRegistryApi } from '../projects/registry.js'
import { createAgentRoutes } from './routes.js'
import { type AgentServiceApi, AgentServiceError } from './service.js'

const snapshot: AgentRuntimeSnapshot = {
  source: { state: 'connected', version: '0.8.2', protocol: 20 },
  stale: false,
  items: [],
}

const service = (values: Partial<AgentServiceApi> = {}): AgentServiceApi => ({
  snapshot: () => snapshot,
  subscribe: () => () => undefined,
  output: vi.fn().mockResolvedValue({ text: 'output', truncated: false }),
  prompt: vi.fn().mockResolvedValue(undefined),
  input: vi.fn().mockResolvedValue(undefined),
  focus: vi.fn().mockResolvedValue(undefined),
  stopAgent: vi.fn().mockResolvedValue(undefined),
  launch: vi.fn().mockResolvedValue({
    agent: {
      id: 'terminal-1',
      name: 'codex-herdr-roam',
      provider: 'codex',
      status: 'idle',
      cwd: '/work/herdr-roam',
      attachTarget: 'w1:p1',
    },
    workspaceId: 'workspace-1',
    paneId: 'w1:p1',
  }),
  ...values,
})

const projects: ProjectRegistryApi = {
  snapshot: vi.fn().mockResolvedValue({ configPath: '/tmp/config.json', projects: [] }),
  get: vi.fn().mockResolvedValue({ name: 'herdr-roam', path: '/work/herdr-roam' }),
  add: vi.fn(),
  discover: vi.fn(),
  remove: vi.fn(),
  subscribe: vi.fn(),
}

const routes = (agentService = service()) => createAgentRoutes(agentService, projects)

describe('Agent routes', () => {
  it('returns the current snapshot', async () => {
    const response = await routes().request('/')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(snapshot)
  })

  it('maps output success and expected service errors', async () => {
    const success = await routes().request('/terminal-1/output')
    await expect(success.json()).resolves.toEqual({
      agentId: 'terminal-1',
      text: 'output',
      truncated: false,
    })

    const missing = await routes(
      service({
        output: vi.fn().mockRejectedValue(new AgentServiceError('agent_not_found', 'missing')),
      }),
    ).request('/terminal-1/output')
    expect(missing.status).toBe(404)
    await expect(missing.json()).resolves.toEqual({
      error: { code: 'agent_not_found', message: 'missing' },
    })
  })

  it('accepts valid Prompts and rejects invalid input', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined)
    const success = await routes(service({ prompt })).request('/terminal-1/prompts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Review the change.' }),
    })
    expect(success.status).toBe(202)
    await expect(success.json()).resolves.toEqual({ agentId: 'terminal-1' })
    expect(prompt).toHaveBeenCalledWith('terminal-1', {
      text: 'Review the change.',
      images: [],
    })

    const invalid = await routes().request('/terminal-1/prompts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '   ' }),
    })
    expect(invalid.status).toBe(400)
  })

  it('accepts local image Prompts and rejects invalid image bytes', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined)
    const form = new FormData()
    form.set('text', 'Inspect this screenshot.')
    form.append(
      'images',
      new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'screen.png', {
        type: 'image/png',
      }),
    )
    const success = await routes(service({ prompt })).request('/terminal-1/prompts', {
      method: 'POST',
      body: form,
    })

    expect(success.status).toBe(202)
    expect(prompt).toHaveBeenCalledWith('terminal-1', {
      text: 'Inspect this screenshot.',
      images: [expect.objectContaining({ type: 'image/png', extension: 'png' })],
    })

    const invalid = new FormData()
    invalid.set('text', '')
    invalid.append('images', new File(['plain text'], 'screen.png', { type: 'image/png' }))
    const rejected = await routes().request('/terminal-1/prompts', {
      method: 'POST',
      body: invalid,
    })
    expect(rejected.status).toBe(400)
    await expect(rejected.json()).resolves.toMatchObject({
      error: { code: 'invalid_prompt_image' },
    })
  })

  it('accepts native Agent key and text input and rejects unsupported keys', async () => {
    const input = vi.fn().mockResolvedValue(undefined)
    const agentRoutes = routes(service({ input }))
    const keys = await agentRoutes.request('/terminal-1/input', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'keys', keys: ['shift+tab', 'down', 'enter'] }),
    })
    const text = await agentRoutes.request('/terminal-1/input', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'text', text: '保留现有数据。' }),
    })
    const invalid = await agentRoutes.request('/terminal-1/input', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'keys', keys: ['ctrl+c'] }),
    })

    expect(keys.status).toBe(202)
    expect(text.status).toBe(202)
    expect(invalid.status).toBe(400)
    expect(input).toHaveBeenNthCalledWith(1, 'terminal-1', {
      type: 'keys',
      keys: ['shift+tab', 'down', 'enter'],
    })
    expect(input).toHaveBeenNthCalledWith(2, 'terminal-1', {
      type: 'text',
      text: '保留现有数据。',
    })
  })

  it('rejects Prompt and direct input text above the UTF-8 byte limit', async () => {
    const oversized = '中'.repeat(Math.ceil(AGENT_TEXT_MAX_BYTES / 3) + 1)
    const agentRoutes = routes()
    const prompt = await agentRoutes.request('/terminal-1/prompts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: oversized }),
    })
    const input = await agentRoutes.request('/terminal-1/input', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'text', text: oversized }),
    })

    expect(prompt.status).toBe(400)
    expect(input.status).toBe(400)
  })

  it.each([
    ['agent_not_found', 404],
    ['agent_not_ready', 409],
    ['runtime_unavailable', 503],
  ] as const)('maps Prompt error %s to HTTP %s', async (code, status) => {
    const prompt = vi.fn().mockRejectedValue(new AgentServiceError(code, 'failed'))
    const response = await routes(service({ prompt })).request('/terminal-1/prompts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Continue.' }),
    })
    expect(response.status).toBe(status)
  })

  it.each([
    ['agent_not_found', 404],
    ['agent_not_ready', 409],
    ['agent_input_unavailable', 409],
    ['runtime_unavailable', 503],
  ] as const)('maps Agent input error %s to HTTP %s', async (code, status) => {
    const input = vi.fn().mockRejectedValue(new AgentServiceError(code, 'failed'))
    const response = await routes(service({ input })).request('/terminal-1/input', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'keys', keys: ['enter'] }),
    })
    expect(response.status).toBe(status)
  })

  it('launches a registered Project Agent and focuses a live Agent', async () => {
    const launch = vi.fn().mockResolvedValue({
      agent: {
        id: 'terminal-1',
        name: 'codex-herdr-roam',
        provider: 'codex',
        status: 'idle',
        cwd: '/work/herdr-roam',
        attachTarget: 'w1:p1',
      },
      workspaceId: 'workspace-1',
      paneId: 'w1:p1',
    })
    const focus = vi.fn().mockResolvedValue(undefined)
    const agentRoutes = routes(service({ launch, focus }))
    const launched = await agentRoutes.request('/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        projectName: 'herdr-roam',
        provider: 'codex',
        prompt: 'Review the change.',
      }),
    })
    expect(launched.status).toBe(201)
    expect(launch).toHaveBeenCalledWith(
      { name: 'herdr-roam', path: '/work/herdr-roam' },
      'codex',
      'Review the change.',
    )

    const focused = await agentRoutes.request('/terminal-1/focus', { method: 'POST' })
    expect(focused.status).toBe(200)
    expect(focus).toHaveBeenCalledWith('terminal-1')
  })

  it('stops an Agent and maps expected stop errors', async () => {
    const stopAgent = vi.fn().mockResolvedValue(undefined)
    const stopped = await routes(service({ stopAgent })).request('/terminal-1', {
      method: 'DELETE',
    })
    expect(stopped.status).toBe(200)
    await expect(stopped.json()).resolves.toEqual({ agentId: 'terminal-1' })
    expect(stopAgent).toHaveBeenCalledWith('terminal-1')

    const unavailable = await routes(
      service({
        stopAgent: vi
          .fn()
          .mockRejectedValue(new AgentServiceError('agent_stop_unavailable', 'close failed')),
      }),
    ).request('/terminal-1', { method: 'DELETE' })
    expect(unavailable.status).toBe(409)
    await expect(unavailable.json()).resolves.toEqual({
      error: { code: 'agent_stop_unavailable', message: 'close failed' },
    })
  })
})
