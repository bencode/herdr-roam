import type { SessionActivityEntry, SessionEntry, SessionProvider } from '@herdr-roam/shared'
import { AlertTriangle, ChevronRight, Image as ImageIcon } from 'lucide-react'
import { Markdown } from '../../../components/markdown'
import { cn } from '../../../lib/cn'
import styles from './style.module.scss'

const Activity = ({ activity }: { readonly activity: SessionActivityEntry }) => (
  <details className={cn('group text-xs', styles.readingColumn, styles.activity)}>
    <summary
      className={cn(
        'list-none text-muted hover:text-foreground [&::-webkit-details-marker]:hidden',
        styles.activitySummary,
      )}
    >
      <ChevronRight className="size-3 transition-transform duration-150 group-open:rotate-90" />
      <span className="font-mono">{activity.name}</span>
      <span
        className={cn('capitalize', activity.status === 'failed' ? 'text-danger' : 'text-faint')}
      >
        {activity.status}
      </span>
    </summary>
    {(activity.input || activity.output) && (
      <div className={styles.activityContent}>
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
    <div className={styles.transcript}>
      {entries.map(entry => {
        if (entry.kind === 'omission') {
          const size =
            entry.bytes >= 1024 * 1024
              ? `${(entry.bytes / (1024 * 1024)).toFixed(1)} MB`
              : `${Math.ceil(entry.bytes / 1024)} KB`
          return (
            <div
              key={entry.id}
              className={cn('text-xs text-muted', styles.readingColumn, styles.omission)}
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
          <article key={entry.id} className={cn(styles.readingColumn, styles.message)}>
            <p
              className={cn(
                'font-[650] text-xs text-muted',
                styles.author,
                entry.role === 'assistant' && 'text-primary',
              )}
            >
              {author.toUpperCase()}
            </p>
            <div className={cn('text-sm', styles.messageBody)}>
              {entry.text && (
                <Markdown
                  text={entry.text}
                  headingLevelOffset={1}
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
