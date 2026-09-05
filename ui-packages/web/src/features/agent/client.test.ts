import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchAgentOutput,
  fetchAgentSnapshot,
  focusAgentInHerdr,
  launchProjectAgent,
  sendAgentInput,
  stopAgent,
  submitAgentPrompt,
} from './client'

afterEach(() => vi.restoreAllMocks())

describe('Agent API client', () => {
  it('validates Agent snapshots and output', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            source: { state: 'connected', version: '0.8.2', protocol: 20 },
            stale: false,
            items: [],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ agentId: 'terminal-1', text: 'output', truncated: false }), {
          status: 200,
        }),
      )

    await expect(fetchAgentSnapshot()).resolves.toMatchObject({ source: { state: 'connected' } })
    await expect(fetchAgentOutput('terminal-1')).resolves.toEqual({
      agentId: 'terminal-1',
      text: 'output',
      truncated: false,
    })
  })

  it('rejects malformed success payloads and parses Agent API errors', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'agent_not_found', message: 'missing' } }), {
          status: 404,
        }),
      )

    await expect(fetchAgentSnapshot()).rejects.toMatchObject({
      code: 'invalid_response',
    })
    await expect(fetchAgentOutput('missing')).rejects.toMatchObject({
      code: 'agent_not_found',
    })
  })

  it('submits a Prompt and validates the receipt', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ agentId: 'terminal-1' }), { status: 202 }))

    await expect(submitAgentPrompt('terminal-1', 'Review the change.')).resolves.toEqual({
      agentId: 'terminal-1',
    })
    expect(fetch).toHaveBeenCalledWith('/api/agents/terminal-1/prompts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Review the change.' }),
    })
  })

  it('submits image Prompts as multipart data', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ agentId: 'terminal-1' }), { status: 202 }))
    const image = new File(['image'], 'screen.png', { type: 'image/png' })

    await submitAgentPrompt('terminal-1', 'Inspect this.', [image])
    const request = fetch.mock.calls[0]?.[1]
    const body = request?.body
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('text')).toBe('Inspect this.')
    expect((body as FormData).getAll('images')).toEqual([image])
    expect(request?.headers).toBeUndefined()
  })

  it('submits native Agent key and text input', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ agentId: 'terminal-1' }), { status: 202 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ agentId: 'terminal-1' }), { status: 202 }),
      )

    await expect(
      sendAgentInput('terminal-1', { type: 'keys', keys: ['shift+tab'] }),
    ).resolves.toEqual({
      agentId: 'terminal-1',
    })
    await expect(
      sendAgentInput('terminal-1', { type: 'text', text: '继续测试。' }),
    ).resolves.toEqual({ agentId: 'terminal-1' })
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/agents/terminal-1/input', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'keys', keys: ['shift+tab'] }),
    })
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/agents/terminal-1/input', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'text', text: '继续测试。' }),
    })
  })

  it('launches and focuses Agents through explicit mutations', async () => {
    const receipt = {
      agent: {
        id: 'terminal-1',
        name: 'codex-herdr-roam',
        provider: 'codex',
        status: 'idle',
        cwd: '/work/herdr-roam',
        attachTarget: 'w1:p1',
        session: null,
      },
      workspaceId: 'workspace-1',
      paneId: 'w1:p1',
    }
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(receipt), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ agentId: 'terminal-1' }), { status: 200 }),
      )

    await expect(
      launchProjectAgent({
        projectName: 'herdr-roam',
        provider: 'codex',
        prompt: 'Review the change.',
      }),
    ).resolves.toEqual(receipt)
    await expect(focusAgentInHerdr('terminal-1')).resolves.toEqual({ agentId: 'terminal-1' })
    expect(fetch).toHaveBeenLastCalledWith('/api/agents/terminal-1/focus', { method: 'POST' })
  })

  it('stops an Agent through an explicit DELETE mutation', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ agentId: 'terminal-1' }), { status: 200 }))

    await expect(stopAgent('terminal-1')).resolves.toEqual({ agentId: 'terminal-1' })
    expect(fetch).toHaveBeenCalledWith('/api/agents/terminal-1', { method: 'DELETE' })
  })

  it('opens a selected workspace without serializing a Prompt', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          agent: {
            id: 'terminal-2',
            name: 'codex-task',
            provider: 'codex',
            status: 'idle',
            cwd: '/tmp/task',
            attachTarget: 'w2:p1',
            session: null,
          },
          workspaceId: 'w2',
          paneId: 'w2:p1',
        }),
        { status: 201 },
      ),
    )
    await launchProjectAgent({ projectName: 'project', provider: 'codex', workspaceId: 'task' })
    expect(fetch).toHaveBeenCalledWith('/api/agents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projectName: 'project', provider: 'codex', workspaceId: 'task' }),
    })
  })
})
