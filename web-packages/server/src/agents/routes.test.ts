import type { AgentRuntimeSnapshot } from '@herdr-roam/shared'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectRegistryApi } from '../projects/registry.js'
import { createAgentRoutes } from './routes.js'
import { AgentServiceError, type AgentServiceApi } from './service.js'

const snapshot: AgentRuntimeSnapshot = {
  source: { state: 'connected', version: '0.8.2', protocol: 20 },
  stale: false,
  items: [],
}

const service = (values: Partial<AgentServiceApi> = {}): AgentServiceApi => ({
  snapshot: () => snapshot,
  subscribe: () => () => undefined,
  output: vi.fn().mockResolvedValue('output'),
  prompt: vi.fn().mockResolvedValue(undefined),
  focus: vi.fn().mockResolvedValue(undefined),
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
    await expect(success.json()).resolves.toEqual({ agentId: 'terminal-1', text: 'output' })

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
    const success = await routes(service({ prompt })).request(
      '/terminal-1/prompts',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'Review the change.' }),
      },
    )
    expect(success.status).toBe(202)
    await expect(success.json()).resolves.toEqual({ agentId: 'terminal-1' })
    expect(prompt).toHaveBeenCalledWith('terminal-1', 'Review the change.')

    const invalid = await routes().request('/terminal-1/prompts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '   ' }),
    })
    expect(invalid.status).toBe(400)
  })

  it.each([
    ['agent_not_found', 404],
    ['agent_not_ready', 409],
    ['runtime_unavailable', 503],
  ] as const)('maps Prompt error %s to HTTP %s', async (code, status) => {
    const prompt = vi.fn().mockRejectedValue(new AgentServiceError(code, 'failed'))
    const response = await routes(service({ prompt })).request(
      '/terminal-1/prompts',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'Continue.' }),
      },
    )
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
})
