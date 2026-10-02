import { AGENT_TEXT_MAX_BYTES, type AgentStatus } from '@herdr-roam/shared'
import { type KeyboardEvent, useId, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { submitAgentPrompt } from '../agent/client'

const readinessMessage = (status: AgentStatus, runtimeAvailable: boolean): string => {
  if (!runtimeAvailable || status === 'unknown') return 'Agent is not available right now.'
  if (status === 'blocked') return 'Agent is blocked. Respond in its Terminal.'
  if (status === 'working') return 'working · ↵ send follow-up'
  return `${status} · ↵ send`
}

export const AssistantComposer = ({
  agentId,
  status,
  runtimeAvailable,
}: {
  readonly agentId: string
  readonly status: AgentStatus
  readonly runtimeAvailable: boolean
}) => {
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const fieldId = useId()
  const statusId = useId()
  const ready = runtimeAvailable && (status === 'idle' || status === 'done' || status === 'working')
  const tooLarge = new TextEncoder().encode(draft).byteLength > AGENT_TEXT_MAX_BYTES
  const canSubmit = ready && !tooLarge && draft.trim().length > 0 && !submitting

  useLayoutEffect(() => {
    const field = fieldRef.current
    if (!field) return
    field.style.height = 'auto'
    if (draft) field.style.height = `${Math.min(field.scrollHeight, 144)}px`
  }, [draft])

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await submitAgentPrompt(agentId, draft)
      setDraft('')
    } catch (failure) {
      console.error('Assistant Prompt submission failed', failure)
      setError(failure instanceof Error ? failure.message : 'The Prompt could not be sent.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    void submit()
  }

  const message = submitting
    ? 'sending…'
    : tooLarge
      ? 'Prompt is too large (64 KB maximum).'
      : (error ?? readinessMessage(status, runtimeAvailable))

  return (
    <section className="flex-none border-border border-t bg-background px-3 py-2.5">
      <label
        className="flex cursor-text items-start rounded-md border border-border bg-surface px-2.5 py-2 transition-[border-color,box-shadow] duration-150 focus-within:border-primary focus-within:shadow-[0_0_0_1px_var(--primary)]"
        htmlFor={fieldId}
      >
        <span className="sr-only">Ask the Agent</span>
        <textarea
          ref={fieldRef}
          id={fieldId}
          aria-describedby={statusId}
          className="block max-h-36 min-h-10 w-full resize-none overflow-y-auto border-0 bg-transparent p-0 text-sm leading-5 caret-primary outline-none! placeholder:text-muted disabled:cursor-not-allowed"
          disabled={!ready}
          onChange={event => {
            setDraft(event.target.value)
            setError(null)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this document…"
          rows={2}
          value={draft}
        />
      </label>
      <p
        className={cn(
          'mt-1 mb-0 min-h-4 text-right text-[0.6875rem] leading-4 text-faint',
          (error || tooLarge) && 'text-danger',
          !error && !tooLarge && !ready && 'text-warning',
        )}
        id={statusId}
        role="status"
      >
        {message}
      </p>
    </section>
  )
}
