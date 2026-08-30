import type { AgentStatus } from '@herdr-roam/shared'
import { type KeyboardEvent, useId, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../../../lib/cn'
import { submitAgentPrompt } from '../client'

const readinessMessage = (
  status: AgentStatus,
  runtimeAvailable: boolean,
  unavailableMessage: string,
): string => {
  if (!runtimeAvailable) return unavailableMessage
  if (status === 'working') return 'Agent is working. You can draft a follow-up while you wait.'
  if (status === 'blocked') return 'Agent is blocked. Use terminal Attach to respond.'
  if (status === 'unknown') return 'Agent readiness is unknown. Wait for a reliable status.'
  return `${status} · ↵ send`
}

export const PromptComposer = ({
  agentId,
  status,
  runtimeAvailable,
  unavailableMessage,
}: {
  readonly agentId: string
  readonly status: AgentStatus
  readonly runtimeAvailable: boolean
  readonly unavailableMessage: string
}) => {
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ readonly kind: 'error' | 'success'; readonly text: string } | null>(null)
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  const fieldId = useId()
  const statusId = useId()
  const ready = runtimeAvailable && (status === 'idle' || status === 'done')
  const canSubmit = ready && draft.trim().length > 0 && !submitting

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
      await submitAgentPrompt(agentId, draft)
      setDraft('')
      setFeedback({ kind: 'success', text: 'Prompt submitted.' })
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

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    void submit()
  }

  const message = submitting
    ? 'sending…'
    : (feedback?.text ?? readinessMessage(status, runtimeAvailable, unavailableMessage))

  return (
    <section className="flex-none border-border border-t bg-background px-5 py-3">
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
            setDraft(event.target.value)
            setFeedback(null)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Send a follow-up…"
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
