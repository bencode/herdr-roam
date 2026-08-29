import { ArrowUp, ExternalLink, FileText } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../../lib/cn'
import { projectByName, type SessionMessage, sessionById } from '../../../mock/data'
import type { ResourceRef } from '../../../workbench/resource'

export const SessionTab = ({
  resource,
  onOpen,
}: {
  readonly resource: Extract<ResourceRef, { type: 'session' }>
  readonly onOpen: (resource: ResourceRef) => void
}) => {
  const session = sessionById(resource.projectName, resource.sessionId)
  const project = projectByName(resource.projectName)
  const [draft, setDraft] = useState('')
  const [localMessages, setLocalMessages] = useState<readonly SessionMessage[]>([])
  if (!session)
    return <p className="grid h-full place-items-center text-muted">Session is unavailable.</p>

  const send = () => {
    const body = draft.trim()
    if (!body) return
    setLocalMessages(messages => [
      ...messages,
      { id: `local-${messages.length + 1}`, author: 'You', body },
    ])
    setDraft('')
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex min-h-12 items-center gap-2 border-border border-b px-4">
        <p className="m-0 min-w-0 flex-1 truncate text-sm max-[68rem]:[&>span]:hidden">
          <span className="text-muted">{project?.name} / Session / </span>
          <strong>{session.title}</strong>
        </p>
        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-primary text-xs">
          {session.status}
        </span>
        <span className="rounded-full bg-raised px-2 py-0.5 text-muted text-xs">
          {session.provider}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto w-[min(760px,calc(100%_-_40px))] py-8">
          {[...session.messages, ...localMessages].map(message => (
            <article
              key={message.id}
              className="grid grid-cols-[72px_1fr] gap-4 pb-7 max-[68rem]:grid-cols-[64px_1fr]"
            >
              <p
                className={cn(
                  'mt-0 pt-0.5 font-[650] text-xs text-muted',
                  message.author !== 'You' && 'text-primary',
                )}
              >
                {message.author.toUpperCase()}
              </p>
              <p className="m-0 max-w-[70ch] text-sm leading-7">{message.body}</p>
            </article>
          ))}
          {session.artifact && (
            <button
              type="button"
              className="ml-22 flex max-w-xl items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5 text-left hover:border-primary max-[68rem]:ml-20"
              onClick={() => session.artifact && onOpen(session.artifact)}
            >
              <FileText className="w-4 text-primary" />
              <span className="min-w-0 flex-1 truncate font-mono text-xs">
                {session.artifact.type === 'file' ? session.artifact.path : 'Artifact'}
              </span>
              <ExternalLink className="w-3.5 text-muted" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-none px-5 pb-4">
        <form
          className="mx-auto w-full max-w-3xl rounded-lg border border-border bg-background p-3"
          onSubmit={event => {
            event.preventDefault()
            send()
          }}
        >
          <textarea
            className="block h-8 w-full resize-none border-0 bg-transparent outline-0 placeholder:text-faint"
            aria-label="Continue this Session"
            placeholder="Continue this Session…"
            value={draft}
            onChange={event => setDraft(event.target.value)}
          />
          <div className="flex items-center text-faint text-xs">
            <span>
              {project?.name} · {session.provider} · local interaction fixture
            </span>
            <button
              type="submit"
              disabled={!draft.trim()}
              className="ml-auto grid size-7 place-items-center rounded-md border-0 bg-primary text-white"
              aria-label="Send local fixture Prompt"
            >
              <ArrowUp className="size-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
