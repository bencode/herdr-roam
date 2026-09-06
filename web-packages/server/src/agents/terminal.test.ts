import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { AgentRuntimeSnapshot, TerminalConnection, TerminalEvent } from '@herdr-roam/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebSocket } from 'ws'
import { createTerminalSession } from '../herdr/terminal-session.js'
import { registerAgentTerminals } from './terminal.js'

const cleanups: Array<() => Promise<void>> = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup()
  vi.restoreAllMocks()
})
const snapshot: AgentRuntimeSnapshot = {
  source: { state: 'connected', version: '0.8.2', protocol: 20 },
  stale: false,
  items: [
    {
      id: 'terminal-1',
      name: 'Test',
      provider: 'codex',
      status: 'idle',
      cwd: '/tmp',
      attachTarget: 'w1:p1',
      session: null,
    },
  ],
}

const startServer = async () => {
  const script = `
    let seq = 0;
    const frame = bytes => console.log(JSON.stringify({ type: 'terminal.frame', seq: ++seq, encoding: 'ansi', width: 80, height: 24, full: seq === 1, bytes }));
    frame(Buffer.from('Ready').toString('base64'));
    require('node:readline').createInterface({ input: process.stdin }).on('line', line => {
      const command = JSON.parse(line);
      if (command.type === 'terminal.release') process.exit(0);
      if (command.type === 'terminal.input') frame(command.bytes);
    });
  `
  const open = vi.fn((target: string, connection: TerminalConnection) =>
    createTerminalSession(target, connection, () => spawn(process.execPath, ['-e', script])),
  )
  const server = createServer()
  const stop = registerAgentTerminals(server, { snapshot: () => snapshot }, open)
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  cleanups.push(async () => {
    stop()
    server.close()
    await once(server, 'close')
  })
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  return { open, origin }
}

const connect = (
  origin: string,
  mode = 'control',
  browserOrigin = origin,
  agentId = 'terminal-1',
) => {
  const socket = new WebSocket(
    `${origin.replace('http:', 'ws:')}/api/agents/${agentId}/terminal?mode=${mode}&cols=80&rows=24&takeover=false`,
    { origin: browserOrigin },
  )
  const events: TerminalEvent[] = []
  socket.on('message', bytes => events.push(JSON.parse(bytes.toString()) as TerminalEvent))
  return { socket, events }
}

describe('Agent terminal WebSocket', () => {
  it('rejects foreign origins and unknown Agents before launching a helper', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { origin, open } = await startServer()
    const foreign = connect(origin, 'control', 'https://example.com')
    await expect(once(foreign.socket, 'open')).rejects.toThrow('403')
    const unknown = connect(origin, 'control', origin, 'missing')
    await expect(once(unknown.socket, 'open')).rejects.toThrow('403')
    expect(open).not.toHaveBeenCalled()
  })

  it('forwards input in order only after frames are consumed and releases on disconnect', async () => {
    const { origin, open } = await startServer()
    const { socket, events } = connect(origin)
    await vi.waitFor(() => expect(events).toHaveLength(1))
    socket.send(JSON.stringify({ type: 'terminal.ack', seq: 1 }))
    socket.send(
      JSON.stringify({ type: 'terminal.input', bytes: Buffer.from('你好').toString('base64') }),
    )
    await vi.waitFor(() => expect(events).toHaveLength(2))
    expect(events[1]).toMatchObject({
      type: 'terminal.frame',
      seq: 2,
      full: false,
      bytes: Buffer.from('你好').toString('base64'),
    })
    const session = open.mock.results[0]?.value
    const released = vi.spyOn(session, 'release')
    socket.close()
    await once(socket, 'close')
    await vi.waitFor(() => expect(released).toHaveBeenCalled())
  })

  it('rejects forged writes on an observer connection', async () => {
    const { origin } = await startServer()
    const { socket, events } = connect(origin, 'observe')
    await vi.waitFor(() => expect(events).toHaveLength(1))
    socket.send(JSON.stringify({ type: 'terminal.input', bytes: 'YQ==' }))
    await once(socket, 'close')
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'terminal.error', message: 'This terminal is read-only.' }),
    )
  })
})
