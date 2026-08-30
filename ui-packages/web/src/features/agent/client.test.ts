import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAgentOutput, fetchAgentSnapshot, submitAgentPrompt } from './client'

afterEach(() => vi.restoreAllMocks())

describe('Agent API client', () => {
  it('validates Agent snapshots and output', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            source: { state: 'connected', version: '0.8.2', protocol: 20 },
            stale: false,
            observedDirectories: [],
            items: [],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ agentId: 'terminal-1', text: 'output' }), { status: 200 }),
      )

    await expect(fetchAgentSnapshot()).resolves.toMatchObject({ source: { state: 'connected' } })
    await expect(fetchAgentOutput('terminal-1')).resolves.toEqual({
      agentId: 'terminal-1',
      text: 'output',
    })
  })

  it('rejects malformed success payloads and parses Agent API errors', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: { code: 'agent_not_found', message: 'missing' } }),
          { status: 404 },
        ),
      )

    await expect(fetchAgentSnapshot()).rejects.toMatchObject({
      code: 'invalid_response',
    })
    await expect(fetchAgentOutput('missing')).rejects.toMatchObject({
      code: 'agent_not_found',
    })
  })

  it('submits a Prompt and validates the receipt', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ agentId: 'terminal-1' }), { status: 202 }),
    )

    await expect(submitAgentPrompt('terminal-1', 'Review the change.')).resolves.toEqual({
      agentId: 'terminal-1',
    })
    expect(fetch).toHaveBeenCalledWith('/api/agents/terminal-1/prompts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Review the change.' }),
    })
  })
})
