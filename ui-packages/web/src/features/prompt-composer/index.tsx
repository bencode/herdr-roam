import { AGENT_TEXT_MAX_BYTES, type AgentStatus } from '@herdr-roam/shared'
import {
  type ClipboardEvent,
  type KeyboardEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { cn } from '../../lib/cn'
import { sendAgentInput, submitAgentPrompt } from '../agent/client'
import { PromptAttachments, usePromptImages } from './attachments'

const readinessMessage = (
  status: AgentStatus,
  runtimeAvailable: boolean,
  unavailableMessage: string,
): string => {
  if (!runtimeAvailable) return unavailableMessage
  if (status === 'working') return 'working · ↵ send follow-up'
  if (status === 'blocked') return 'Agent is blocked. Open its Terminal Inspector to respond.'
  if (status === 'unknown') return 'Agent readiness is unknown. Wait for a reliable status.'
  return `${status} · ↵ send`
}

export const PromptComposer = ({
  agentId,
  status,
  runtimeAvailable,
  unavailableMessage,
  onSubmitted,
  focusWhenReady = false,
}: {
  readonly agentId: string
  readonly status: AgentStatus
  readonly runtimeAvailable: boolean
  readonly unavailableMessage: string
  readonly onSubmitted?: () => void
  readonly focusWhenReady?: boolean
}) => {
  const [draft, setDraft] = useState('')
  const promptImages = usePromptImages()
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{
    readonly kind: 'error' | 'success'
    readonly text: string
  } | null>(null)
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const focusedInitially = useRef(false)
  const fieldId = useId()
  const statusId = useId()
  const ready = runtimeAvailable && (status === 'idle' || status === 'done' || status === 'working')
  const textWithinLimit = new TextEncoder().encode(draft).byteLength <= AGENT_TEXT_MAX_BYTES
  const canSubmit =
    ready &&
    textWithinLimit &&
    (draft.trim().length > 0 || promptImages.images.length > 0) &&
    !submitting

  useLayoutEffect(() => {
    if (!focusWhenReady || !ready || focusedInitially.current) return
    fieldRef.current?.focus()
    focusedInitially.current = true
  }, [focusWhenReady, ready])

  useLayoutEffect(() => {
    const field = fieldRef.current
    if (!field) return
    field.style.height = 'auto'
    if (!draft) return
    field.style.height = `${Math.min(field.scrollHeight, 144)}px`
  }, [draft])

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setFeedback(null)
    try {
      await submitAgentPrompt(agentId, draft, promptImages.files)
      promptImages.clear()
      setDraft('')
      setFeedback({ kind: 'success', text: 'Prompt submitted.' })
      onSubmitted?.()
    } catch (error) {
      console.error('Agent Prompt submission failed', error)
      setFeedback({
        kind: 'error',
        text: error instanceof Error ? error.message : 'The Prompt could not be submitted.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const forwardShiftTab = async () => {
    if (!runtimeAvailable || submitting) return
    setFeedback(null)
    try {
      await sendAgentInput(agentId, { type: 'keys', keys: ['shift+tab'] })
      setFeedback({ kind: 'success', text: 'Shift+Tab sent to the Agent.' })
    } catch (error) {
      console.error('Agent key submission failed', error)
      setFeedback({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Shift+Tab could not be sent.',
      })
    }
  }

  const pasteImages = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = Array.from(event.clipboardData.files).filter(file =>
      file.type.startsWith('image/'),
    )
    if (pasted.length === 0) return
    event.preventDefault()
    const error = promptImages.add(pasted)
    setFeedback(error ? { kind: 'error', text: error } : null)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === 'Tab' &&
      event.shiftKey &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      event.preventDefault()
      void forwardShiftTab()
      return
    }
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    void submit()
  }

  const message = submitting
    ? 'sending…'
    : (feedback?.text ?? readinessMessage(status, runtimeAvailable, unavailableMessage))

  return (
    <section className="flex-none border-border border-t bg-background px-5 py-3">
      <PromptAttachments
        images={promptImages.images}
        onRemove={image => {
          promptImages.remove(image)
          setFeedback(null)
        }}
      />
      <label className="group flex cursor-text items-start gap-2 font-mono" htmlFor={fieldId}>
        <span className="sr-only">Send a Prompt</span>
        <span
          aria-hidden="true"
          className={cn(
            'pt-0.5 text-sm leading-5 group-focus-within:font-semibold',
            ready ? 'text-primary' : 'text-faint',
          )}
        >
          ❯
        </span>
        <textarea
          ref={fieldRef}
          id={fieldId}
          aria-describedby={statusId}
          className="prompt-composer-field block max-h-36 min-h-10 w-full cursor-text resize-none overflow-y-auto border-0 bg-transparent p-0 font-mono text-sm leading-5 caret-primary outline-none placeholder:text-muted"
          onChange={event => {
            const next = event.target.value
            setDraft(next)
            setFeedback(
              new TextEncoder().encode(next).byteLength > AGENT_TEXT_MAX_BYTES
                ? { kind: 'error', text: 'Prompt is too large (64 KB maximum).' }
                : null,
            )
          }}
          onKeyDown={handleKeyDown}
          onPaste={pasteImages}
          placeholder="Send a Prompt…"
          rows={2}
          value={draft}
        />
      </label>
      <p
        className={cn(
          'mt-1 mb-0 min-h-4 text-right font-mono text-[0.6875rem] leading-4 text-faint',
          feedback?.kind === 'error' && 'text-danger',
        )}
        id={statusId}
        role="status"
      >
        {message}
      </p>
    </section>
  )
}
