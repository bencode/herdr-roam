import type { TerminalMode } from '@herdr-roam/shared'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '../../../ui/button'
import { type BrowserTerminalSession, connectBrowserTerminal, type TerminalState } from './session'
import '@xterm/xterm/css/xterm.css'

export const BrowserTerminal = ({
  agentId,
  available,
  controlsContainer,
}: {
  readonly agentId: string
  readonly available: boolean
  readonly controlsContainer: HTMLElement | null
}) => {
  const container = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const session = useRef<BrowserTerminalSession | null>(null)
  const autoConnectAttempted = useRef(false)
  const mode = useRef<TerminalMode>('control')
  const [state, setState] = useState<TerminalState>({
    phase: 'connecting',
    message: 'Connecting to Herdr…',
  })

  const disconnect = useCallback(() => {
    session.current?.dispose()
    session.current = null
    if (terminalRef.current) terminalRef.current.options.disableStdin = true
    setState({ phase: 'disconnected', message: 'Disconnected. The Agent has not been stopped.' })
  }, [])
  const resize = useCallback(() => {
    const terminal = terminalRef.current
    const dimensions = fitRef.current?.proposeDimensions()
    if (
      !terminal ||
      !dimensions ||
      !container.current?.clientHeight ||
      !container.current.clientWidth ||
      mode.current !== 'control'
    )
      return
    const cols = Math.max(2, Math.min(1000, dimensions.cols))
    const rows = Math.max(1, Math.min(1000, dimensions.rows))
    if (terminal.cols !== cols || terminal.rows !== rows) {
      terminal.resize(cols, rows)
      session.current?.resize(cols, rows)
    }
  }, [])
  const connect = useCallback(
    (nextMode: TerminalMode, takeover = false) => {
      const terminal = terminalRef.current
      if (!available || !terminal) return
      autoConnectAttempted.current = true
      disconnect()
      mode.current = nextMode
      resize()
      try {
        session.current = connectBrowserTerminal({
          agentId,
          connection: { mode: nextMode, takeover, cols: terminal.cols, rows: terminal.rows },
          renderer: terminal,
          onState: next => {
            setState(next)
            terminal.options.disableStdin = next.phase !== 'connected' || nextMode === 'observe'
            if (next.phase === 'connected') {
              resize()
              if (nextMode === 'control') terminal.focus()
            }
          },
        })
      } catch (error) {
        console.error(
          'Terminal startup failed',
          error instanceof Error ? error.name : 'Unknown error',
        )
        setState({ phase: 'error', message: 'The browser could not open a terminal connection.' })
      }
    },
    [agentId, available, disconnect, resize],
  )

  useEffect(() => {
    if (!container.current) return
    const colors = getComputedStyle(container.current)
    const terminal = new Terminal({
      scrollback: 0,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      disableStdin: true,
      allowProposedApi: false,
      theme: {
        background: colors.getPropertyValue('--terminal-bg').trim() || '#111315',
        foreground: colors.getPropertyValue('--terminal-fg').trim() || '#e5e7eb',
      },
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(container.current)
    terminalRef.current = terminal
    fitRef.current = fit
    const input = terminal.onData(text => session.current?.input(new TextEncoder().encode(text)))
    const binary = terminal.onBinary(text =>
      session.current?.input(Uint8Array.from(text, character => character.charCodeAt(0) & 255)),
    )
    terminal.attachCustomKeyEventHandler(event => {
      if (event.type !== 'keydown' || !['PageUp', 'PageDown'].includes(event.key)) return true
      event.preventDefault()
      session.current?.scroll(event.key === 'PageUp' ? 'up' : 'down', terminal.rows, 'page_key')
      return false
    })
    terminal.attachCustomWheelEventHandler(event => {
      event.preventDefault()
      session.current?.scroll(event.deltaY < 0 ? 'up' : 'down', 3, 'wheel')
      return false
    })
    // Screen streams must never write the host clipboard.
    const clipboard = terminal.parser.registerOscHandler(52, () => true)
    const observer = new ResizeObserver(resize)
    observer.observe(container.current)
    resize()
    return () => {
      disconnect()
      observer.disconnect()
      input.dispose()
      binary.dispose()
      clipboard.dispose()
      terminal.dispose()
      autoConnectAttempted.current = false
      terminalRef.current = null
      fitRef.current = null
    }
  }, [disconnect, resize])

  useEffect(() => {
    if (!available) {
      disconnect()
      return
    }
    if (autoConnectAttempted.current) return
    const timer = window.setTimeout(() => {
      if (!autoConnectAttempted.current) connect('control')
    }, 0)
    return () => window.clearTimeout(timer)
  }, [available, connect, disconnect])

  const connectionLabel = !available
    ? 'Unavailable'
    : state.phase === 'connected' && mode.current === 'observe'
      ? 'Read-only'
      : {
          connected: 'Connected',
          connecting: 'Connecting…',
          disconnected: 'Disconnected',
          busy: 'In use',
          error: 'Connection failed',
        }[state.phase]
  const needsRecovery = ['disconnected', 'error'].includes(state.phase)

  return (
    <section aria-label="Agent terminal" className="flex min-h-0 flex-1 flex-col bg-terminal-bg">
      {controlsContainer &&
        createPortal(
          <>
            <span className="whitespace-nowrap text-muted" role="status" title={state.message}>
              Terminal: {connectionLabel}
            </span>
            {available && needsRecovery && (
              <Button size="compact" onClick={() => connect('control')}>
                Reconnect
              </Button>
            )}
            {available && state.phase === 'busy' && (
              <>
                <Button size="compact" onClick={() => connect('observe')}>
                  Observe
                </Button>
                <Button size="compact" onClick={() => connect('control', true)}>
                  Take over
                </Button>
              </>
            )}
          </>,
          controlsContainer,
        )}
      {available && (needsRecovery || state.phase === 'busy') && (
        <p
          className="m-0 border-border border-b bg-surface px-4 py-2 text-xs text-muted"
          role="status"
        >
          {state.message}
        </p>
      )}
      <div ref={container} className="min-h-0 min-w-0 flex-1 overflow-auto p-2" />
    </section>
  )
}
