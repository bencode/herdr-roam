import { Terminal } from '@xterm/xterm'
import { useEffect, useRef } from 'react'
import '@xterm/xterm/css/xterm.css'

const ESCAPE = String.fromCharCode(27)
const SGR = new RegExp(`${ESCAPE}\\[[0-9;]*m`, 'g')
const MIN_COLS = 20
const MAX_COLS = 200

const screenLines = (text: string, rows: number): readonly string[] => {
  const lines = text.replace(/\r/g, '').split('\n')
  const end = lines.findLastIndex(line => line.replace(SGR, '').trim() !== '') + 1
  return lines.slice(Math.max(0, end - rows), end)
}

const visibleWidth = (lines: readonly string[]): number =>
  Math.min(MAX_COLS, Math.max(MIN_COLS, ...lines.map(line => [...line.replace(SGR, '')].length)))

export const TerminalPreview = ({
  text,
  rows,
}: {
  readonly text: string
  readonly rows: number
}) => {
  const frame = useRef<HTMLDivElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const terminal = useRef<Terminal | null>(null)

  useEffect(() => {
    if (!host.current || !frame.current) return
    const colors = getComputedStyle(frame.current)
    const instance = new Terminal({
      rows,
      cols: MIN_COLS,
      scrollback: 0,
      fontSize: 10,
      lineHeight: 1.1,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      disableStdin: true,
      cursorBlink: false,
      cursorInactiveStyle: 'none',
      theme: {
        background: colors.getPropertyValue('--terminal-bg').trim() || '#111315',
        foreground: colors.getPropertyValue('--terminal-fg').trim() || '#e5e7eb',
      },
    })
    instance.open(host.current)
    terminal.current = instance
    return () => {
      instance.dispose()
      terminal.current = null
    }
  }, [rows])

  useEffect(() => {
    const instance = terminal.current
    if (!instance || !frame.current || !host.current) return
    const lines = screenLines(text, rows)
    instance.resize(visibleWidth(lines), rows)
    instance.reset()
    instance.write(`${ESCAPE}[?25l${lines.join('\r\n')}`)
    const scale = Math.min(1, frame.current.clientWidth / Math.max(1, host.current.scrollWidth))
    host.current.style.transform = `scale(${scale})`
  }, [text, rows])

  return (
    <div
      ref={frame}
      className="pointer-events-none min-h-0 overflow-hidden bg-terminal-bg px-2 py-1.5"
      aria-hidden="true"
    >
      <div ref={host} className="w-max origin-top-left" />
    </div>
  )
}
