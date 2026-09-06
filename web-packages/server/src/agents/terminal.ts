import type { IncomingMessage, Server } from 'node:http'
import type { Duplex } from 'node:stream'
import {
  TERMINAL_INPUT_MAX_BYTES,
  type TerminalConnection,
  type TerminalEvent,
} from '@herdr-roam/shared'
import { WebSocket, WebSocketServer } from 'ws'
import {
  createTerminalSession,
  type HerdrTerminalSession,
  parseTerminalCommand,
} from '../herdr/terminal-session.js'
import type { AgentServiceApi } from './service.js'

const localHost = (hostname: string) => ['localhost', '127.0.0.1', '[::1]'].includes(hostname)

const connectionRequest = (request: IncomingMessage) => {
  const host = request.headers.host
  const origin = request.headers.origin
  if (!host || !origin) throw new Error('A same-origin browser connection is required.')
  const url = new URL(request.url ?? '', `http://${host}`)
  const source = new URL(origin)
  if (
    !localHost(url.hostname) ||
    source.host !== url.host ||
    source.protocol !== 'http:' ||
    source.username ||
    source.password
  ) {
    throw new Error('Terminal connections must be local and same-origin.')
  }
  const match = /^\/api\/agents\/([^/]+)\/terminal$/.exec(url.pathname)
  if (!match) throw new Error('Unknown terminal endpoint.')
  const mode = url.searchParams.get('mode')
  const cols = Number(url.searchParams.get('cols'))
  const rows = Number(url.searchParams.get('rows'))
  const takeover = url.searchParams.get('takeover') ?? 'false'
  if (
    (mode !== 'control' && mode !== 'observe') ||
    ![cols, rows].every(value => Number.isInteger(value) && value > 0 && value <= 1000) ||
    !['true', 'false'].includes(takeover) ||
    (mode === 'observe' && takeover === 'true')
  ) {
    throw new Error('Invalid terminal connection parameters.')
  }
  return {
    agentId: decodeURIComponent(match[1] ?? ''),
    connection: { mode, cols, rows, takeover: takeover === 'true' } satisfies TerminalConnection,
  }
}

const bridgeTerminal = (socket: WebSocket, session: HerdrTerminalSession) => {
  let acknowledge: ((seq: number) => void) | undefined
  let cancelAcknowledgement: (() => void) | undefined
  let lastSequence = 0
  let closed = false
  const send = (event: TerminalEvent) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(event))
  }
  const cleanup = () => {
    if (closed) return
    closed = true
    cancelAcknowledgement?.()
    session.release()
  }
  const fail = (message: string) => {
    if (closed) return
    send({ type: 'terminal.error', code: 'protocol_error', message })
    cleanup()
    socket.close(1008, 'Terminal connection failed')
  }
  socket.on('error', error => {
    console.error('Terminal WebSocket failed', error.message)
    cleanup()
  })
  socket.once('close', cleanup)
  socket.on('message', (data, binary) => {
    try {
      if (binary) throw new Error('Terminal messages must be JSON.')
      const command = parseTerminalCommand(data.toString())
      if (command.type === 'terminal.ack') {
        if (!acknowledge) throw new Error('Unexpected terminal acknowledgement.')
        acknowledge(command.seq)
      } else if (command.type === 'terminal.release') {
        cleanup()
        socket.close(1000, 'Released')
      } else session.write(command)
    } catch (error) {
      fail(
        error instanceof SyntaxError
          ? 'Invalid terminal JSON.'
          : error instanceof Error
            ? error.message
            : 'Invalid terminal input.',
      )
    }
  })

  const deliver = (event: Extract<TerminalEvent, { type: 'terminal.frame' }>) =>
    new Promise<void>((resolve, reject) => {
      if ((!lastSequence && !event.full) || event.seq !== lastSequence + 1) {
        reject(new Error('Terminal frame sequence is invalid.'))
        return
      }
      lastSequence = event.seq
      const finish = () => {
        clearTimeout(timer)
        acknowledge = undefined
        cancelAcknowledgement = undefined
      }
      const timer = setTimeout(() => {
        finish()
        reject(new Error('Terminal renderer stopped responding.'))
      }, 30_000)
      cancelAcknowledgement = () => {
        finish()
        resolve()
      }
      acknowledge = seq => {
        if (seq !== event.seq) throw new Error('Terminal acknowledgement is out of order.')
        finish()
        resolve()
      }
      send(event)
    })

  void (async () => {
    try {
      for await (const event of session.events()) {
        if (closed) break
        if (event.type === 'terminal.frame') await deliver(event)
        else {
          send(event)
          break
        }
      }
      if (!closed) {
        send({ type: 'terminal.closed', reason: 'Terminal connection ended.' })
        socket.close(1000)
      }
    } catch (error) {
      console.error(
        'Herdr terminal transport failed',
        error instanceof SyntaxError
          ? 'Invalid Herdr terminal JSON.'
          : error instanceof Error
            ? error.message
            : 'Unknown transport error',
      )
      fail(
        error instanceof SyntaxError
          ? 'Invalid Herdr terminal JSON.'
          : error instanceof Error
            ? error.message
            : 'Herdr terminal is unavailable.',
      )
    } finally {
      cleanup()
    }
  })()
}

export const registerAgentTerminals = (
  server: Server,
  agents: Pick<AgentServiceApi, 'snapshot'>,
  openSession = createTerminalSession,
) => {
  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: TERMINAL_INPUT_MAX_BYTES,
    perMessageDeflate: false,
  })
  const upgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    try {
      const { agentId, connection } = connectionRequest(request)
      const snapshot = agents.snapshot()
      if (snapshot.stale || snapshot.source.state !== 'connected')
        throw new Error('Agent runtime is unavailable.')
      const agent = snapshot.items.find(item => item.id === agentId)
      if (!agent) throw new Error('Agent is unavailable.')
      sockets.handleUpgrade(request, socket, head, ws => {
        try {
          bridgeTerminal(ws, openSession(agent.id, connection))
        } catch (error) {
          console.error(
            'Terminal startup failed',
            error instanceof Error ? error.message : 'Unknown startup error',
          )
          ws.send(
            JSON.stringify({
              type: 'terminal.error',
              code: 'unavailable',
              message: 'Herdr terminal could not be started.',
            } satisfies TerminalEvent),
          )
          ws.close(1011)
        }
      })
    } catch (error) {
      console.warn(
        'Terminal upgrade rejected',
        error instanceof URIError || error instanceof TypeError
          ? 'Invalid request URL.'
          : error instanceof Error
            ? error.message
            : 'Invalid terminal request.',
      )
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
    }
  }
  server.on('upgrade', upgrade)
  return () => {
    server.off('upgrade', upgrade)
    for (const socket of sockets.clients) socket.terminate()
    sockets.close()
  }
}
