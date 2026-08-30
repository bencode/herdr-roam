import type { AgentRuntimeSnapshot } from '@herdr-roam/shared'
import { describe, expect, it, vi } from 'vitest'
import { createAgentRoutes } from './routes.js'
import { AgentServiceError, type AgentServiceApi } from './service.js'

const snapshot: AgentRuntimeSnapshot = {
  source: { state: 'connected', version: '0.8.2', protocol: 20 },
  stale: false,
  items: [],
}

const service = (
  output: AgentServiceApi['output'] = vi.fn().mockResolvedValue('output'),
  prompt: AgentServiceApi['prompt'] = vi.fn().mockResolvedValue(undefined),
): AgentServiceApi => ({
  snapshot: () => snapshot,
  subscribe: () => () => undefined,
  output,
  prompt,
})

describe('Agent routes', () => {
  it('returns the current snapshot', async () => {
    const response = await createAgentRoutes(service()).request('/')
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual(snapshot)
  })

  it('maps output success and expected service errors', async () => {
    const success = await createAgentRoutes(service()).request('/terminal-1/output')
    await expect(success.json()).resolves.toEqual({ agentId: 'terminal-1', text: 'output' })

    const missing = await createAgentRoutes(
      service(vi.fn().mockRejectedValue(new AgentServiceError('agent_not_found', 'missing'))),
    ).request('/terminal-1/output')
    expect(missing.status).toBe(404)
    await expect(missing.json()).resolves.toEqual({
      error: { code: 'agent_not_found', message: 'missing' },
    })
  })

  it('accepts valid Prompts and rejects invalid input', async () => {
    const prompt = vi.fn().mockResolvedValue(undefined)
    const success = await createAgentRoutes(service(undefined, prompt)).request(
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

    const invalid = await createAgentRoutes(service()).request('/terminal-1/prompts', {
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
    const response = await createAgentRoutes(service(undefined, prompt)).request(
      '/terminal-1/prompts',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'Continue.' }),
      },
    )
    expect(response.status).toBe(status)
  })
})
