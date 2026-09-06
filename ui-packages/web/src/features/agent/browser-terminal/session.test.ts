import type { TerminalMode } from '@herdr-roam/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { connectBrowserTerminal } from './session'

const frame = {
  type: 'terminal.frame',
  seq: 1,
  encoding: 'ansi',
  width: 80,
  height: 24,
  full: true,
  bytes: btoa('Ready'),
}
const connections: Array<ReturnType<typeof connectBrowserTerminal>> = []
afterEach(() => {
  connections.splice(0).forEach(session => {
    session.dispose()
  })
  vi.restoreAllMocks()
})

const connect = (mode: TerminalMode = 'control') => {
  const socket = {
    readyState: WebSocket.OPEN,
    bufferedAmount: 0,
    send: vi.fn(),
    close: vi.fn(),
    onmessage: null as ((event: MessageEvent) => void) | null,
    onclose: null as (() => void) | null,
    onerror: null as (() => void) | null,
  }
  const renderer = {
    reset: vi.fn(),
    resize: vi.fn(),
    write: vi.fn<(bytes: Uint8Array, done: () => void) => void>(),
  }
  const onState = vi.fn()
  const createSocket = vi.fn(() => socket as unknown as WebSocket)
  const session = connectBrowserTerminal({
    agentId: 'terminal-1',
    connection: { mode, cols: 80, rows: 24, takeover: false },
    renderer,
    onState,
    createSocket,
  })
  connections.push(session)
  return {
    session,
    socket,
    renderer,
    onState,
    createSocket,
    receive: (value: unknown) =>
      socket.onmessage?.(new MessageEvent('message', { data: JSON.stringify(value) })),
  }
}

describe('browser terminal connection', () => {
  it('acknowledges only consumed frames and sends UTF-8 input without replay', () => {
    const { session, socket, renderer, receive } = connect()
    session.input(new TextEncoder().encode('ignored before ready'))
    expect(socket.send).not.toHaveBeenCalled()
    receive(frame)
    expect(renderer.reset).toHaveBeenCalledOnce()
    expect(Array.from(renderer.write.mock.calls[0]?.[0] ?? [])).toEqual(
      Array.from(new TextEncoder().encode('Ready')),
    )
    expect(socket.send).not.toHaveBeenCalled()
    renderer.write.mock.calls[0]?.[1]()
    expect(socket.send).toHaveBeenCalledWith('{"type":"terminal.ack","seq":1}')
    session.input(new TextEncoder().encode('你好\r'))
    expect(socket.send).toHaveBeenLastCalledWith(
      JSON.stringify({
        type: 'terminal.input',
        bytes: btoa(String.fromCharCode(...new TextEncoder().encode('你好\r'))),
      }),
    )
    session.dispose()
    const count = socket.send.mock.calls.length
    session.input(new TextEncoder().encode('not replayed'))
    expect(socket.send).toHaveBeenCalledTimes(count)
    expect(socket.send).toHaveBeenLastCalledWith('{"type":"terminal.release"}')
  })

  it('does not send input, resize, or scroll in read-only mode', () => {
    const { session, socket, renderer, receive } = connect('observe')
    receive(frame)
    renderer.write.mock.calls[0]?.[1]()
    socket.send.mockClear()
    session.input(new Uint8Array([13]))
    session.resize(120, 40)
    session.scroll('up', 3, 'wheel')
    expect(socket.send).not.toHaveBeenCalled()
    expect(renderer.resize).toHaveBeenCalledWith(80, 24)
  })

  it('rejects missing initial snapshots and out-of-order deltas', () => {
    const missing = connect()
    missing.receive({ ...frame, full: false })
    expect(missing.socket.close).toHaveBeenCalled()
    expect(missing.onState).toHaveBeenLastCalledWith(expect.objectContaining({ phase: 'error' }))
    const ordered = connect()
    ordered.receive(frame)
    ordered.renderer.write.mock.calls[0]?.[1]()
    ordered.receive({ ...frame, full: false, seq: 3 })
    expect(ordered.renderer.write).toHaveBeenCalledOnce()
    expect(ordered.socket.close).toHaveBeenCalled()
  })

  it('preserves ownership feedback and never automatically reconnects', () => {
    const { receive, onState, socket, createSocket } = connect()
    receive({ type: 'terminal.error', code: 'busy', message: 'Controlled elsewhere.' })
    socket.onclose?.()
    expect(onState).toHaveBeenLastCalledWith({ phase: 'busy', message: 'Controlled elsewhere.' })
    expect(createSocket).toHaveBeenCalledOnce()
    expect(createSocket.mock.calls[0]).toBeDefined()
  })

  it('ignores pending render callbacks after release', () => {
    const { session, renderer, receive, socket } = connect()
    receive(frame)
    session.dispose()
    socket.send.mockClear()
    renderer.write.mock.calls[0]?.[1]()
    expect(socket.send).not.toHaveBeenCalled()
  })
})
