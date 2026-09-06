import { spawn } from 'node:child_process'
import { once } from 'node:events'
import type { TerminalConnection, TerminalEvent } from '@herdr-roam/shared'
import { describe, expect, it, vi } from 'vitest'
import { createTerminalSession, parseTerminalCommand } from './terminal-session.js'

const connection: TerminalConnection = { mode: 'control', cols: 80, rows: 24, takeover: false }
const frame = {
  type: 'terminal.frame',
  seq: 1,
  encoding: 'ansi',
  width: 80,
  height: 24,
  full: true,
  bytes: Buffer.from('你好\u001b[31m').toString('base64'),
}
const collect = async (events: AsyncGenerator<TerminalEvent>) => {
  const values: TerminalEvent[] = []
  for await (const value of events) values.push(value)
  return values
}

describe('Herdr terminal transport', () => {
  it('parses fragmented and coalesced frames without altering ANSI bytes', async () => {
    const text = `${JSON.stringify(frame)}\n${JSON.stringify({ ...frame, seq: 2, full: false })}\n`
    const start = vi.fn((args: readonly string[]) =>
      spawn(process.execPath, [
        '-e',
        `process.stdout.write(${JSON.stringify(text.slice(0, 30))}); setTimeout(() => process.stdout.end(${JSON.stringify(text.slice(30))}), 10)`,
        '--',
        ...args,
      ]),
    )
    const session = createTerminalSession('terminal-1', connection, start)
    expect(await collect(session.events())).toEqual([frame, { ...frame, seq: 2, full: false }])
    expect(start).toHaveBeenCalledWith([
      'terminal',
      'session',
      'control',
      'terminal-1',
      '--cols',
      '80',
      '--rows',
      '24',
    ])
  })

  it.each([
    [
      'terminal attach failed: terminal terminal-1 already has an attached client; retry with --takeover',
      'busy',
    ],
    ['terminal attach taken over', 'taken_over'],
  ])('preserves native ownership outcome: %s', async (reason, code) => {
    const line = JSON.stringify({ type: 'terminal.closed', reason })
    const session = createTerminalSession('terminal-1', connection, () =>
      spawn(process.execPath, ['-e', `console.log(${JSON.stringify(line)})`]),
    )
    expect(await collect(session.events())).toEqual([
      expect.objectContaining({ type: 'terminal.error', code }),
    ])
  })

  it('rejects truncated streams and reports failed CLI startup', async () => {
    const truncated = createTerminalSession('terminal-1', connection, () =>
      spawn(process.execPath, ['-e', 'process.stdout.write("{")']),
    )
    await expect(collect(truncated.events())).rejects.toThrow('within a frame')
    const failed = createTerminalSession('terminal-1', connection, () =>
      spawn(process.execPath, [
        '-e',
        'process.stderr.write("unsupported terminal session command"); process.exit(1)',
      ]),
    )
    await expect(collect(failed.events())).rejects.toThrow('unsupported terminal session command')
  })

  it('forwards UTF-8 input and gracefully releases only its helper', async () => {
    const child = spawn(process.execPath, [
      '-e',
      `
      const readline = require('node:readline');
      readline.createInterface({ input: process.stdin }).on('line', line => {
        const command = JSON.parse(line);
        if (command.type === 'terminal.release') process.exit(0);
        console.log(JSON.stringify({ ...${JSON.stringify(frame)}, bytes: command.bytes }));
      });
    `,
    ])
    const closed = once(child, 'close')
    const session = createTerminalSession('terminal-1', connection, () => child)
    const events = session.events()
    const next = events.next()
    session.write({ type: 'terminal.input', bytes: Buffer.from('继续\r').toString('base64') })
    expect((await next).value).toEqual({
      ...frame,
      bytes: Buffer.from('继续\r').toString('base64'),
    })
    session.release()
    expect((await closed)[0]).toBe(0)
    await events.return()
  })

  it('rejects all observer mutations and validates wire input', async () => {
    const child = spawn(process.execPath, ['-e', 'process.stdin.resume()'])
    const closed = once(child, 'close')
    const session = createTerminalSession(
      'terminal-1',
      { ...connection, mode: 'observe' },
      () => child,
    )
    expect(() => session.write({ type: 'terminal.input', bytes: 'YQ==' })).toThrow('read-only')
    expect(() => session.write({ type: 'terminal.resize', cols: 120, rows: 30 })).toThrow(
      'read-only',
    )
    expect(() => parseTerminalCommand('{"type":"terminal.input","bytes":"%%%"}')).toThrow(
      'Invalid terminal command',
    )
    session.release()
    await closed
  })
})
