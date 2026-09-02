import { mkdtemp, rm } from 'node:fs/promises'
import { createServer, type Server } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createHerdrClient, HerdrApiError } from './client.js'

let server: Server | null = null
let directory: string | null = null

type ReceivedRequest = {
  readonly id: string
  readonly method: string
  readonly params: Readonly<Record<string, unknown>>
}

const socketServer = async (response: (request: ReceivedRequest) => string): Promise<string> => {
  directory = await mkdtemp(join(tmpdir(), 'herdr-roam-client-'))
  const socketPath = join(directory, 'herdr.sock')
  server = createServer(socket => {
    socket.once('data', data => {
      const request = JSON.parse(data.toString('utf8')) as ReceivedRequest
      const line = response(request)
      socket.write(line.slice(0, 12))
      socket.end(line.slice(12))
    })
  })
  await new Promise<void>((resolve, reject) => {
    server?.once('error', reject)
    server?.listen(socketPath, resolve)
  })
  return socketPath
}

afterEach(async () => {
  await new Promise<void>(resolve => server?.close(() => resolve()) ?? resolve())
  if (directory) await rm(directory, { recursive: true, force: true })
  server = null
  directory = null
})

describe('Herdr socket client', () => {
  it('reads a fragmented agent.list response', async () => {
    const socketPath = await socketServer(
      request =>
        `${JSON.stringify({
          id: request.id,
          result: {
            type: 'agent_list',
            agents: [
              {
                terminal_id: 'terminal-1',
                agent_status: 'idle',
                workspace_id: 'w1',
                tab_id: 't1',
                pane_id: 'w1:p1',
              },
            ],
          },
        })}\n`,
    )
    await expect(createHerdrClient(socketPath).listAgents()).resolves.toHaveLength(1)
  })

  it('exposes Herdr API errors', async () => {
    const socketPath = await socketServer(
      request =>
        `${JSON.stringify({ id: request.id, error: { code: 'agent_not_found', message: 'missing' } })}\n`,
    )
    await expect(createHerdrClient(socketPath).listAgents()).rejects.toBeInstanceOf(HerdrApiError)
  })

  it('reads a bounded recent ANSI snapshot', async () => {
    let received: ReceivedRequest | null = null
    const socketPath = await socketServer(request => {
      received = request
      return `${JSON.stringify({
        id: request.id,
        result: { type: 'pane_read', read: { text: '\u001b[32mready' } },
      })}\n`
    })

    await expect(createHerdrClient(socketPath).readAgent('w1:p1', 500)).resolves.toBe(
      '\u001b[32mready',
    )
    expect(received).toMatchObject({
      method: 'agent.read',
      params: {
        target: 'w1:p1',
        source: 'recent_unwrapped',
        lines: 500,
        strip_ansi: false,
        format: 'ansi',
      },
    })
  })

  it('submits an agent prompt to the requested target', async () => {
    let received: ReceivedRequest | null = null
    const socketPath = await socketServer(request => {
      received = request
      return `${JSON.stringify({
        id: request.id,
        result: { type: 'agent_prompted', agent: {} },
      })}\n`
    })

    await expect(
      createHerdrClient(socketPath).promptAgent('w1:p1', 'Review the change.'),
    ).resolves.toBeUndefined()
    expect(received).toMatchObject({
      method: 'agent.prompt',
      params: { target: 'w1:p1', text: 'Review the change.' },
    })
  })

  it('sends validated keys to the requested Agent', async () => {
    let received: ReceivedRequest | null = null
    const socketPath = await socketServer(request => {
      received = request
      return `${JSON.stringify({ id: request.id, result: { type: 'ok' } })}\n`
    })

    await expect(
      createHerdrClient(socketPath).sendAgentKeys('w1:p1', ['down', 'enter']),
    ).resolves.toBeUndefined()
    expect(received).toMatchObject({
      method: 'agent.send_keys',
      params: { target: 'w1:p1', keys: ['down', 'enter'] },
    })
  })

  it('sends text and trailing keys to a Pane in one input request', async () => {
    let received: ReceivedRequest | null = null
    const socketPath = await socketServer(request => {
      received = request
      return `${JSON.stringify({ id: request.id, result: { type: 'ok' } })}\n`
    })

    await expect(
      createHerdrClient(socketPath).sendPaneInput('w1:p1', 'Preserve the current data.', ['enter']),
    ).resolves.toBeUndefined()
    expect(received).toMatchObject({
      method: 'pane.send_input',
      params: {
        pane_id: 'w1:p1',
        text: 'Preserve the current data.',
        keys: ['enter'],
      },
    })
  })

  it('closes the requested Pane without closing its Workspace', async () => {
    let received: ReceivedRequest | null = null
    const socketPath = await socketServer(request => {
      received = request
      return `${JSON.stringify({ id: request.id, result: { type: 'ok' } })}\n`
    })

    await expect(createHerdrClient(socketPath).closePane('w1:p1')).resolves.toBeUndefined()
    expect(received).toMatchObject({
      method: 'pane.close',
      params: { pane_id: 'w1:p1' },
    })
  })

  it('creates a non-focusing Workspace rooted in the Project', async () => {
    let received: ReceivedRequest | null = null
    const socketPath = await socketServer(request => {
      received = request
      return `${JSON.stringify({
        id: request.id,
        result: {
          type: 'workspace_created',
          workspace: { workspace_id: 'workspace-1' },
          root_pane: { pane_id: 'w1:p1', terminal_id: 'terminal-1' },
        },
      })}\n`
    })

    await expect(
      createHerdrClient(socketPath).createWorkspace('/work/herdr-roam', 'codex-herdr-roam'),
    ).resolves.toEqual({
      workspaceId: 'workspace-1',
      paneId: 'w1:p1',
      terminalId: 'terminal-1',
    })
    expect(received).toMatchObject({
      method: 'workspace.create',
      params: {
        cwd: '/work/herdr-roam',
        label: 'codex-herdr-roam',
        focus: false,
        env: {},
      },
    })
  })

  it('starts a named Agent in the created Pane', async () => {
    let received: ReceivedRequest | null = null
    const socketPath = await socketServer(request => {
      received = request
      return `${JSON.stringify({
        id: request.id,
        result: {
          type: 'agent_started',
          agent: {
            terminal_id: 'terminal-1',
            agent_status: 'unknown',
            workspace_id: 'workspace-1',
            tab_id: 'tab-1',
            pane_id: 'w1:p1',
            name: 'codex-herdr-roam',
            launch_pending: true,
          },
          argv: ['codex'],
        },
      })}\n`
    })

    await expect(
      createHerdrClient(socketPath).startAgent(
        'codex-herdr-roam',
        'codex',
        'w1:p1',
        ['resume', 'session-1'],
        30_000,
      ),
    ).resolves.toMatchObject({ name: 'codex-herdr-roam', launch_pending: true })
    expect(received).toMatchObject({
      method: 'agent.start',
      params: {
        name: 'codex-herdr-roam',
        kind: 'codex',
        pane_id: 'w1:p1',
        args: ['resume', 'session-1'],
        timeout_ms: 30_000,
      },
    })
  })
})
