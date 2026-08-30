import { mkdtemp, rm } from 'node:fs/promises'
import { createServer, type Server } from 'node:net'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
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
    const socketPath = await socketServer(request =>
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
    const socketPath = await socketServer(request =>
      `${JSON.stringify({ id: request.id, error: { code: 'agent_not_found', message: 'missing' } })}\n`,
    )
    await expect(createHerdrClient(socketPath).listAgents()).rejects.toBeInstanceOf(HerdrApiError)
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

    await expect(createHerdrClient(socketPath).promptAgent('w1:p1', 'Review the change.')).resolves.toBeUndefined()
    expect(received).toMatchObject({
      method: 'agent.prompt',
      params: { target: 'w1:p1', text: 'Review the change.' },
    })
  })
})
