import { ArrowDown } from 'lucide-react'
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { fetchAgentOutput } from '../../client'
import { type AnsiSpan, parseAnsi } from './ansi'

const OUTPUT_REFRESH_MS = 2_000
const FOLLOW_THRESHOLD_PX = 24

const occurrenceKey = (value: string, occurrences: Map<string, number>): string => {
  const occurrence = occurrences.get(value) ?? 0
  occurrences.set(value, occurrence + 1)
  return `${value}\u0000${occurrence}`
}

const terminalSpanStyle = ({ style }: AnsiSpan): CSSProperties => {
  const foreground = style.fg ?? 'var(--terminal-fg)'
  const background = style.bg ?? 'transparent'
  const decorations = [style.underline ? 'underline' : '', style.strike ? 'line-through' : '']
    .filter(Boolean)
    .join(' ')

  return {
    color: style.inverse ? (style.bg ?? 'var(--terminal-bg)') : foreground,
    backgroundColor: style.inverse ? foreground : background,
    fontStyle: style.italic ? 'italic' : undefined,
    fontWeight: style.bold ? 600 : undefined,
    opacity: style.dim ? 0.65 : undefined,
    textDecoration: decorations || undefined,
  }
}

export const TerminalOutput = ({
  agentId,
  canRead,
}: {
  readonly agentId: string
  readonly canRead: boolean
}) => {
  const outputRef = useRef<HTMLDivElement>(null)
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [following, setFollowing] = useState(true)
  const [hasNewOutput, setHasNewOutput] = useState(false)

  useEffect(() => {
    if (!canRead) return
    let active = true
    let reading = false

    const read = async () => {
      if (reading) return
      reading = true
      try {
        const next = await fetchAgentOutput(agentId)
        if (!active) return
        setOutput(next.text)
        setError(null)
      } catch (readError) {
        if (!active) return
        console.error('Agent output read failed', readError)
        setError(readError instanceof Error ? readError.message : 'Recent output is unavailable.')
      } finally {
        reading = false
      }
    }

    void read()
    const interval = setInterval(() => void read(), OUTPUT_REFRESH_MS)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [agentId, canRead])

  useEffect(() => {
    const node = outputRef.current
    if (!node || !output) return
    if (following) {
      node.scrollTop = node.scrollHeight
      setHasNewOutput(false)
      return
    }
    setHasNewOutput(true)
  }, [following, output])

  const renderedOutput = output || (canRead ? 'Reading recent output…' : 'No output is available.')
  const lines = useMemo(() => parseAnsi(renderedOutput), [renderedOutput])
  const keyedLines = useMemo(() => {
    const lineOccurrences = new Map<string, number>()
    return lines.map(line => {
      const text = line.map(span => span.text).join('')
      const spanOccurrences = new Map<string, number>()
      return {
        key: occurrenceKey(text, lineOccurrences),
        spans: line.map(span => ({
          key: occurrenceKey(span.text, spanOccurrences),
          value: span,
        })),
      }
    })
  }, [lines])

  const jumpToLatest = () => {
    const node = outputRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
    setFollowing(true)
    setHasNewOutput(false)
  }

  return (
    <section aria-label="Live output" className="relative flex min-h-0 flex-1 flex-col bg-terminal-bg">
      {error && (
        <span
          className="pointer-events-none absolute top-2 right-3 z-10 rounded-md bg-terminal-bg/95 px-2 py-1 text-danger text-xs shadow-[var(--shadow-popover)]"
          role="status"
        >
          {error}
        </span>
      )}
      <div
        ref={outputRef}
        className="terminal-output min-h-0 flex-1 overflow-auto bg-terminal-bg px-6 py-5 font-mono text-terminal-fg text-xs leading-5"
        onScroll={event => {
          const node = event.currentTarget
          const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight <= FOLLOW_THRESHOLD_PX
          setFollowing(atBottom)
          if (atBottom) setHasNewOutput(false)
        }}
      >
        <div className="w-max min-w-full">
          {keyedLines.map(line => (
            <div className="min-h-5 whitespace-pre" key={line.key}>
              {line.spans.map(span => (
                <span key={span.key} style={terminalSpanStyle(span.value)}>
                  {span.value.text}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      {hasNewOutput && (
        <button
          type="button"
          className="absolute bottom-3 left-1/2 flex h-7 -translate-x-1/2 items-center gap-1.5 rounded-md border border-white/20 bg-terminal-bg px-2.5 text-terminal-fg text-xs shadow-[var(--shadow-popover)] hover:bg-white/10 [&_svg]:size-3.5"
          onClick={jumpToLatest}
        >
          <ArrowDown aria-hidden="true" />
          Jump to latest
        </button>
      )}
    </section>
  )
}
