import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { StringDecoder } from 'node:string_decoder'
import {
  TERMINAL_FRAME_MAX_BYTES,
  TERMINAL_INPUT_MAX_BYTES,
  type TerminalCommand,
  type TerminalConnection,
  type TerminalEvent,
} from '@herdr-roam/shared'
import { z } from 'zod'

const dimension = z.number().int().min(1).max(1000)
const base64 = z.string().regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
const frameSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('terminal.frame'),
    seq: z.number().int().positive(),
    encoding: z.literal('ansi'),
    width: dimension,
    height: dimension,
    full: z.boolean(),
    bytes: base64,
  }),
  z.object({ type: z.literal('terminal.closed'), reason: z.string().nullable() }),
])
const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('terminal.input'), bytes: base64 }),
  z.object({ type: z.literal('terminal.resize'), cols: dimension, rows: dimension }),
  z.object({
    type: z.literal('terminal.scroll'),
    direction: z.enum(['up', 'down']),
    lines: z.number().int().min(1).max(1000),
    source: z.enum(['wheel', 'page_key']),
  }),
  z.object({ type: z.literal('terminal.release') }),
  z.object({ type: z.literal('terminal.ack'), seq: z.number().int().positive() }),
])

export const parseTerminalCommand = (text: string): TerminalCommand => {
  if (Buffer.byteLength(text) > TERMINAL_INPUT_MAX_BYTES)
    throw new Error('Terminal input is too large.')
  const parsed = commandSchema.safeParse(JSON.parse(text))
  if (!parsed.success) throw new Error('Invalid terminal command.')
  return parsed.data
}

const terminalEvent = (line: string, target: string): TerminalEvent => {
  const parsed = frameSchema.safeParse(JSON.parse(line))
  if (!parsed.success) throw new Error('Invalid Herdr terminal frame.')
  const event = parsed.data
  if (event.type !== 'terminal.closed') return event
  if (
    event.reason ===
    `terminal attach failed: terminal ${target} already has an attached client; retry with --takeover`
  ) {
    return {
      type: 'terminal.error',
      code: 'busy',
      message: 'This terminal is controlled by another client.',
    }
  }
  if (event.reason === 'terminal attach taken over') {
    return {
      type: 'terminal.error',
      code: 'taken_over',
      message: 'Another client took control of this terminal.',
    }
  }
  return event
}

type SpawnTerminal = (args: readonly string[]) => ChildProcessWithoutNullStreams
const spawnTerminal: SpawnTerminal = args =>
  spawn('herdr', [...args], { shell: false, stdio: 'pipe' })

export const createTerminalSession = (
  target: string,
  connection: TerminalConnection,
  start: SpawnTerminal = spawnTerminal,
) => {
  if (!target || target.startsWith('-')) throw new Error('Invalid terminal target.')
  const args = [
    'terminal',
    'session',
    connection.mode,
    target,
    '--cols',
    String(connection.cols),
    '--rows',
    String(connection.rows),
  ]
  if (connection.takeover) args.push('--takeover')
  const child = start(args)
  let released = false
  let exited = false
  let diagnostic = ''
  let processError: Error | undefined
  let terminateTimer: NodeJS.Timeout | undefined
  let killTimer: NodeJS.Timeout | undefined
  child.stderr.on('data', (chunk: Buffer) => {
    diagnostic = (diagnostic + chunk.toString()).slice(-4096)
  })
  child.on('error', error => {
    processError = error
    child.stdout.destroy(error)
  })
  child.stdin.on('error', error => {
    if (!released) {
      processError = error
      child.stdout.destroy(error)
    }
  })
  const completion = new Promise<void>(resolve => {
    child.once('close', code => {
      exited = true
      clearTimeout(terminateTimer)
      clearTimeout(killTimer)
      if (code && !released)
        processError = new Error(diagnostic.trim() || `Herdr terminal exited with code ${code}.`)
      resolve()
    })
  })

  const release = () => {
    if (released || exited) return
    released = true
    child.stdin.end(connection.mode === 'control' ? '{"type":"terminal.release"}\n' : undefined)
    if (connection.mode === 'observe') child.kill('SIGTERM')
    terminateTimer = setTimeout(() => child.kill('SIGTERM'), 500)
    killTimer = setTimeout(() => child.kill('SIGKILL'), 1500)
    terminateTimer.unref()
    killTimer.unref()
  }

  const events = async function* (): AsyncGenerator<TerminalEvent> {
    const decoder = new StringDecoder('utf8')
    let pending = ''
    try {
      for await (const chunk of child.stdout) {
        pending += decoder.write(chunk as Buffer)
        let newline = pending.indexOf('\n')
        while (newline >= 0) {
          if (Buffer.byteLength(pending.slice(0, newline)) > TERMINAL_FRAME_MAX_BYTES)
            throw new Error('Herdr terminal frame is too large.')
          const line = pending.slice(0, newline)
          pending = pending.slice(newline + 1)
          if (line.trim()) yield terminalEvent(line, target)
          newline = pending.indexOf('\n')
        }
        if (Buffer.byteLength(pending) > TERMINAL_FRAME_MAX_BYTES)
          throw new Error('Herdr terminal frame is too large.')
      }
      pending += decoder.end()
      if (pending.trim() && !released)
        throw new Error('Herdr terminal stream ended within a frame.')
      await completion
      if (processError && !released) throw processError
    } finally {
      release()
    }
  }

  const write = (command: TerminalCommand) => {
    if (command.type === 'terminal.release') {
      release()
      return
    }
    if (command.type === 'terminal.ack')
      throw new Error('Frame acknowledgements belong to the browser transport.')
    if (connection.mode !== 'control') throw new Error('This terminal is read-only.')
    if (released || exited || !child.stdin.writable)
      throw new Error('Terminal connection is closed.')
    if (child.stdin.writableLength > TERMINAL_INPUT_MAX_BYTES)
      throw new Error('Terminal input is backlogged.')
    child.stdin.write(`${JSON.stringify(command)}\n`)
  }
  return { events, write, release }
}

export type HerdrTerminalSession = ReturnType<typeof createTerminalSession>
