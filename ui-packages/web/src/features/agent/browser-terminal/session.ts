import {
  TERMINAL_FRAME_MAX_BYTES,
  TERMINAL_INPUT_MAX_BYTES,
  type TerminalCommand,
  type TerminalConnection,
  type TerminalFrame,
} from '@herdr-roam/shared'

export type TerminalState = {
  readonly phase: 'disconnected' | 'connecting' | 'connected' | 'busy' | 'error'
  readonly message: string
}
type Renderer = {
  readonly reset: () => void
  readonly resize: (cols: number, rows: number) => void
  readonly write: (bytes: Uint8Array, done: () => void) => void
}

const parseFrame = (value: Record<string, unknown>): TerminalFrame => {
  if (
    value.encoding !== 'ansi' ||
    typeof value.full !== 'boolean' ||
    typeof value.seq !== 'number' ||
    !Number.isSafeInteger(value.seq) ||
    value.seq < 1 ||
    ![value.width, value.height].every(
      size => typeof size === 'number' && Number.isInteger(size) && size > 0 && size <= 1000,
    ) ||
    typeof value.bytes !== 'string'
  )
    throw new Error('Invalid terminal frame.')
  return value as TerminalFrame
}

export const connectBrowserTerminal = ({
  agentId,
  connection,
  renderer,
  onState,
  createSocket = url => new WebSocket(url),
}: {
  readonly agentId: string
  readonly connection: TerminalConnection
  readonly renderer: Renderer
  readonly onState: (state: TerminalState) => void
  readonly createSocket?: (url: string) => WebSocket
}) => {
  const url = new URL(`/api/agents/${encodeURIComponent(agentId)}/terminal`, window.location.href)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.search = new URLSearchParams({
    mode: connection.mode,
    cols: String(connection.cols),
    rows: String(connection.rows),
    takeover: String(connection.takeover),
  }).toString()
  const socket = createSocket(url.href)
  let disposed = false
  let ready = false
  let sequence = 0
  let writing = false
  let terminalMessage = false
  onState({ phase: 'connecting', message: 'Connecting to Herdr…' })
  const fail = (message: string) => {
    if (disposed) return
    terminalMessage = true
    ready = false
    clearTimeout(timeout)
    onState({ phase: 'error', message })
    socket.close()
  }
  const timeout = window.setTimeout(
    () => fail('Terminal connection timed out. Reconnect to try again.'),
    15_000,
  )
  const send = (command: TerminalCommand) => {
    if (disposed || socket.readyState !== WebSocket.OPEN) return
    const text = JSON.stringify(command)
    if (
      new TextEncoder().encode(text).length > TERMINAL_INPUT_MAX_BYTES ||
      socket.bufferedAmount > TERMINAL_INPUT_MAX_BYTES
    ) {
      fail('Terminal input is too large or backlogged. Reconnect to try again.')
      return
    }
    socket.send(text)
  }
  socket.onmessage = event => {
    if (disposed || terminalMessage) return
    try {
      if (
        typeof event.data !== 'string' ||
        new TextEncoder().encode(event.data).length > TERMINAL_FRAME_MAX_BYTES
      )
        throw new Error('Invalid terminal message size.')
      const value: unknown = JSON.parse(event.data)
      if (!value || typeof value !== 'object' || !('type' in value))
        throw new Error('Invalid terminal message.')
      if (
        value.type === 'terminal.error' &&
        'message' in value &&
        typeof value.message === 'string'
      ) {
        terminalMessage = true
        ready = false
        clearTimeout(timeout)
        onState({
          phase: 'code' in value && value.code === 'busy' ? 'busy' : 'error',
          message: value.message,
        })
        socket.close()
      } else if (value.type === 'terminal.closed' && 'reason' in value) {
        terminalMessage = true
        ready = false
        clearTimeout(timeout)
        onState({
          phase: 'disconnected',
          message: typeof value.reason === 'string' ? value.reason : 'Terminal connection ended.',
        })
        socket.close()
      } else if (value.type === 'terminal.frame') {
        const frame = parseFrame(value)
        if (writing || frame.seq !== sequence + 1 || (!sequence && !frame.full))
          throw new Error('Terminal frames are out of order.')
        const bytes = Uint8Array.from(atob(frame.bytes), character => character.charCodeAt(0))
        if (!sequence) renderer.reset()
        renderer.resize(frame.width, frame.height)
        sequence = frame.seq
        writing = true
        renderer.write(bytes, () => {
          writing = false
          if (disposed || terminalMessage || socket.readyState !== WebSocket.OPEN) return
          clearTimeout(timeout)
          if (!ready) {
            ready = true
            onState({
              phase: 'connected',
              message: connection.mode === 'control' ? 'Connected' : 'Read-only · current screen',
            })
          }
          send({ type: 'terminal.ack', seq: frame.seq })
        })
      } else throw new Error('Unknown terminal message.')
    } catch (error) {
      console.error(
        'Terminal stream rejected',
        error instanceof Error ? error.name : 'Unknown error',
      )
      fail('The terminal stream is invalid. Reconnect to request a fresh screen.')
    }
  }
  socket.onerror = () =>
    fail('Terminal connection failed. Check that the Agent and Herdr are available.')
  socket.onclose = () => {
    ready = false
    clearTimeout(timeout)
    if (!disposed && !terminalMessage)
      onState({ phase: 'disconnected', message: 'Disconnected. The Agent has not been stopped.' })
  }
  const command = (value: TerminalCommand) => {
    if (ready && connection.mode === 'control') send(value)
  }
  return {
    input: (bytes: Uint8Array) => {
      if (!ready || connection.mode !== 'control') return
      if (bytes.length > 32 * 1024) {
        fail('Paste exceeds 32 KiB. Use a smaller selection.')
        return
      }
      command({
        type: 'terminal.input',
        bytes: btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')),
      })
    },
    resize: (cols: number, rows: number) => command({ type: 'terminal.resize', cols, rows }),
    scroll: (direction: 'up' | 'down', lines: number, source: 'wheel' | 'page_key') =>
      command({ type: 'terminal.scroll', direction, lines, source }),
    dispose: () => {
      if (disposed) return
      send({ type: 'terminal.release' })
      disposed = true
      ready = false
      clearTimeout(timeout)
      socket.close()
    },
  }
}

export type BrowserTerminalSession = ReturnType<typeof connectBrowserTerminal>
