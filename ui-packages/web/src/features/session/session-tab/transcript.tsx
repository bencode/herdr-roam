import type { SessionActivityEntry, SessionEntry, SessionProvider } from '@herdr-roam/shared'
import { AlertTriangle, ChevronRight, Image as ImageIcon } from 'lucide-react'
import { cn } from '../../../lib/cn'
import { Markdown } from '../../../ui/markdown'

const Activity = ({ activity }: { readonly activity: SessionActivityEntry }) => (
  <details className="group ml-22 border-border border-t py-2 text-xs max-[68rem]:ml-18">
    <summary className="flex cursor-pointer list-none items-center gap-2 text-muted hover:text-foreground [&::-webkit-details-marker]:hidden">
      <ChevronRight className="size-3 transition-transform duration-150 group-open:rotate-90" />
      <span className="font-mono">{activity.name}</span>
      <span
        className={cn(
          'ml-auto capitalize',
          activity.status === 'failed' ? 'text-danger' : 'text-faint',
        )}
      >
        {activity.status}
      </span>
    </summary>
    {(activity.input || activity.output) && (
      <div className="mt-2 grid gap-2 pl-5">
        {activity.input && (
          <pre className="m-0 max-h-64 overflow-auto whitespace-pre-wrap rounded-sm bg-raised p-3 font-mono text-[0.6875rem] leading-5">
            {activity.input}
          </pre>
        )}
        {activity.output && (
          <pre className="m-0 max-h-80 overflow-auto whitespace-pre-wrap rounded-sm bg-raised p-3 font-mono text-[0.6875rem] leading-5">
            {activity.output}
          </pre>
        )}
      </div>
    )}
  </details>
)

export const SessionTranscript = ({
  entries,
  provider,
}: {
  readonly entries: readonly SessionEntry[]
  readonly provider: SessionProvider
}) => {
  if (entries.length === 0) {
    return (
      <div className="grid min-h-60 place-items-center text-center text-sm text-muted">
        This Session has no readable messages yet.
      </div>
    )
  }

  return (
    <div className="mx-auto w-[min(960px,calc(100%_-_40px))] py-8">
      {entries.map(entry => {
        if (entry.kind === 'omission') {
          const size =
            entry.bytes >= 1024 * 1024
              ? `${(entry.bytes / (1024 * 1024)).toFixed(1)} MB`
              : `${Math.ceil(entry.bytes / 1024)} KB`
          return (
            <div
              key={entry.id}
              className="my-3 ml-22 flex items-center gap-2 border-border border-y py-3 text-xs text-muted max-[68rem]:ml-18"
              role="note"
            >
              <AlertTriangle className="size-3.5 flex-none text-warning" aria-hidden="true" />A{' '}
              {size} native Session record was omitted to keep this page responsive.
            </div>
          )
        }
        if (entry.kind === 'activity') return <Activity activity={entry} key={entry.id} />
        const author = entry.role === 'user' ? 'You' : provider === 'codex' ? 'Codex' : 'Claude'
        return (
          <article
            key={entry.id}
            className="grid grid-cols-[72px_1fr] gap-4 pb-7 max-[68rem]:grid-cols-[64px_1fr]"
          >
            <p
              className={cn(
                'mt-0 pt-0.5 font-[650] text-xs text-muted',
                entry.role === 'assistant' && 'text-primary',
              )}
            >
              {author.toUpperCase()}
            </p>
            <div className="min-w-0 max-w-[72ch] text-sm leading-7">
              {entry.text && (
                <Markdown
                  text={entry.text}
                  className="[&>:first-child]:mt-0 [&>:last-child]:mb-0"
                />
              )}
              {entry.attachments.length > 0 && (
                <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
                  {entry.attachments.map(attachment => (
                    <li
                      className="flex items-center gap-1.5 rounded-sm bg-raised px-2 py-1 font-mono text-[0.6875rem] text-muted"
                      key={attachment.id}
                    >
                      <ImageIcon className="size-3" />
                      {attachment.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
