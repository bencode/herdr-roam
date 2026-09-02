import { ArrowDown } from 'lucide-react'
import { type CSSProperties, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { cn } from '../../../../lib/cn'
import { fetchAgentOutput, sendAgentInput } from '../../client'
import { type AnsiSpan, parseAnsi } from './ansi'
import { useTerminalInputBridge } from './input'

const OUTPUT_REFRESH_MS = 2_000
const FOLLOW_THRESHOLD_PX = 24

const sendTerminalInput = (...args: Parameters<typeof sendAgentInput>) => sendAgentInput(...args)

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
  canInput,
}: {
  readonly agentId: string
  readonly canRead: boolean
  readonly canInput: boolean
}) => {
  const outputRef = useRef<HTMLDivElement>(null)
  const refreshOutputRef = useRef<() => void>(() => undefined)
  const inputInstructionsId = useId()
  const [output, setOutput] = useState('')
  const [truncated, setTruncated] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)
  const [inputError, setInputError] = useState<string | null>(null)
  const [following, setFollowing] = useState(true)
  const [hasNewOutput, setHasNewOutput] = useState(false)

  useEffect(() => {
    if (!canRead) return
    let active = true
    let pending = false
    let trailing = false

    const read = async () => {
      try {
        const next = await fetchAgentOutput(agentId)
        if (!active) return
        setOutput(next.text)
        setTruncated(next.truncated)
        setReadError(null)
      } catch (readFailure) {
        if (!active) return
        console.error('Agent output read failed', readFailure)
        setReadError(
          readFailure instanceof Error ? readFailure.message : 'Recent output is unavailable.',
        )
      }
    }

    const requestRead = () => {
      if (!active) return
      if (pending) {
        trailing = true
        return
      }
      pending = true
      void read().finally(() => {
        pending = false
        if (active && trailing) {
          trailing = false
          requestRead()
        }
      })
    }

    refreshOutputRef.current = requestRead
    requestRead()
    const interval = setInterval(requestRead, OUTPUT_REFRESH_MS)
    return () => {
      active = false
      trailing = false
      refreshOutputRef.current = () => undefined
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

  const handleInputAccepted = useCallback(() => {
    setFollowing(true)
    refreshOutputRef.current()
  }, [])

  const handleInputError = useCallback((message: string | null) => {
    setInputError(message)
  }, [])

  const inputBridge = useTerminalInputBridge({
    agentId,
    canInput,
    sendInput: sendTerminalInput,
    onInputAccepted: handleInputAccepted,
    onInputError: handleInputError,
  })

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

  const error = inputError ?? readError

  return (
    <section
      ref={inputBridge.terminalRef}
      aria-describedby={canInput ? inputInstructionsId : undefined}
      aria-label="Live output"
      className={cn(
        'relative flex min-h-0 flex-1 flex-col bg-terminal-bg',
        canInput &&
          'cursor-text outline-none focus-visible:ring-1 focus-visible:ring-primary/70 focus-visible:ring-inset focus-within:ring-1 focus-within:ring-primary/70 focus-within:ring-inset',
      )}
      onKeyDown={inputBridge.handleTerminalKeyDown}
      onMouseUp={inputBridge.handleTerminalMouseUp}
      tabIndex={canInput ? 0 : undefined}
    >
      {canInput && (
        <>
          <span className="sr-only" id={inputInstructionsId}>
            Press Enter to start sending terminal input. Escape is sent to the Agent and returns
            focus here.
          </span>
          <textarea
            ref={inputBridge.inputRef}
            aria-label="Agent terminal input"
            autoCapitalize="off"
            autoComplete="off"
            className="pointer-events-none absolute top-0 left-0 size-px resize-none opacity-0 outline-none"
            onCompositionEnd={inputBridge.handleCompositionEnd}
            onCompositionStart={inputBridge.handleCompositionStart}
            onInput={inputBridge.handleTextInput}
            onKeyDown={inputBridge.handleInputKeyDown}
            rows={1}
            spellCheck={false}
            tabIndex={-1}
          />
        </>
      )}
      {error && (
        <span
          className="pointer-events-none absolute top-2 right-3 z-10 rounded-md bg-terminal-bg/95 px-2 py-1 text-danger text-xs shadow-[var(--shadow-popover)]"
          role="status"
        >
          {error}
        </span>
      )}
      {truncated && (
        <span
          className="pointer-events-none absolute top-2 left-3 z-10 rounded-sm bg-terminal-bg/95 px-2 py-1 font-mono text-[0.625rem] text-terminal-fg/70"
          role="status"
          title="Older terminal output is outside the Live snapshot. Open History for durable messages."
        >
          Showing recent output
        </span>
      )}
      <div
        ref={outputRef}
        className="terminal-output min-h-0 flex-1 overflow-auto bg-terminal-bg px-6 py-5 font-mono text-terminal-fg text-xs leading-5"
        onScroll={event => {
          const node = event.currentTarget
          const atBottom =
            node.scrollHeight - node.scrollTop - node.clientHeight <= FOLLOW_THRESHOLD_PX
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
