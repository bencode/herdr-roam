import type { AgentStatus, AgentSummary, SessionSummary } from '@herdr-roam/shared'
import { Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAgentRuntime } from '../../../features/agent/runtime-provider'
import { useProjectSessions } from '../../../features/session/use-session-data'
import { cn } from '../../../lib/cn'
import type { ResourceRef } from '../../../workbench/resource'

const statusClasses: Readonly<Record<AgentStatus, string>> = {
  working: 'bg-primary',
  blocked: 'bg-warning',
  idle: 'bg-primary',
  done: 'bg-success',
  unknown: 'bg-faint',
}

type BrowserFrameProps = {
  readonly title: string
  readonly total: number
  readonly filtered: number
  readonly query: string
  readonly onQuery: (query: string) => void
  readonly leading?: ReactNode
  readonly countLabel?: string | null
  readonly actions?: ReactNode
  readonly children: ReactNode
}

export const ProjectBrowserFrame = ({
  title,
  total,
  filtered,
  query,
  onQuery,
  leading,
  countLabel,
  actions,
  children,
}: BrowserFrameProps) => {
  const resolvedCountLabel =
    countLabel === undefined
      ? query.trim() === ''
        ? String(total)
        : `${filtered}/${total}`
      : countLabel

  return (
    <section className="flex min-h-0 flex-1 flex-col" aria-label={`${title} browser`}>
      <fieldset
        className="m-0 flex min-w-0 flex-none items-center gap-1.5 border-0 bg-sidebar px-2.5 py-2"
        aria-label={`${title} tools`}
      >
        {leading}
        <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-surface px-2 transition-[border-color,box-shadow] duration-150 focus-within:border-primary focus-within:shadow-[0_0_0_1px_var(--primary)] [&>svg]:w-3.5 [&>svg]:flex-none [&>svg]:text-faint">
          <Search aria-hidden="true" />
          <span className="sr-only">Search {title.toLowerCase()}</span>
          <input
            className="min-w-0 flex-1 border-0 bg-transparent text-xs outline-none! placeholder:text-faint"
            aria-label={`Search ${title.toLowerCase()}`}
            value={query}
            onChange={event => onQuery(event.target.value)}
            placeholder={`Search ${title.toLowerCase()}…`}
          />
          {resolvedCountLabel !== null && (
            <span className="flex-none text-[0.625rem] text-muted tabular-nums" aria-live="polite">
              {resolvedCountLabel}
            </span>
          )}
        </label>
        {actions}
      </fieldset>
      <div className="min-h-0 flex-1 overflow-auto px-1.75 pb-3.5">{children}</div>
    </section>
  )
}

const Status = ({ value }: { readonly value: AgentStatus | 'not-running' }) => (
  <i
    className={cn(
      'mt-[0.3rem] size-1.5 flex-none rounded-full',
      value === 'not-running' ? 'bg-faint' : statusClasses[value],
    )}
    role="img"
    aria-label={value}
  />
)

const Empty = ({
  filtered,
  resource,
}: {
  readonly filtered: boolean
  readonly resource: string
}) => (
  <div className="grid justify-items-center gap-1 px-4 py-8 text-center text-muted [&>span]:max-w-52 [&>span]:text-[0.6875rem] [&>span]:leading-normal [&>strong]:text-xs [&>strong]:text-foreground">
    <strong>{filtered ? `No matching ${resource}` : `No ${resource} yet`}</strong>
    <span>{filtered ? 'Try a different search.' : `This project has no ${resource} to show.`}</span>
  </div>
)

const SessionRows = ({
  values,
  agents,
  projectName,
  onOpen,
}: {
  readonly values: readonly SessionSummary[]
  readonly agents: readonly AgentSummary[]
  readonly projectName: string
  readonly onOpen: (resource: ResourceRef) => void
}) => {
  const relativeTime = (timestamp: string): string => {
    const elapsed = Date.now() - Date.parse(timestamp)
    if (elapsed < 60_000) return 'now'
    if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m`
    if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h`
    return `${Math.floor(elapsed / 86_400_000)}d`
  }
  return (
    <div className="grid gap-px">
      {values.map(session => {
        const agent = agents.find(
          candidate =>
            candidate.session?.kind === 'id' &&
            candidate.session.agent === session.provider &&
            candidate.session.value === session.id,
        )
        return (
          <button
            type="button"
            key={`${session.provider}:${session.id}`}
            className="flex min-h-12 w-full min-w-0 items-start gap-2.5 rounded-sm border-0 bg-transparent px-2 py-2.25 text-left text-foreground hover:bg-hover [&>span]:grid [&>span]:min-w-0 [&>span]:flex-1 [&>span]:gap-0.75 [&_small]:truncate [&_small]:text-[0.625rem] [&_small]:text-faint [&_strong]:truncate [&_strong]:text-xs [&_strong]:font-semibold"
            onClick={() =>
              onOpen({
                type: 'session',
                projectName,
                provider: session.provider,
                sessionId: session.id,
              })
            }
            title={session.title}
          >
            <Status value={agent?.status ?? 'not-running'} />
            <span>
              <strong>{session.title}</strong>
              <small>
                <span className="capitalize">{session.provider}</span> ·{' '}
                {relativeTime(session.updatedAt)}
              </small>
            </span>
          </button>
        )
      })}
    </div>
  )
}

type Props = {
  readonly projectName: string
  readonly query: string
  readonly onQuery: (query: string) => void
  readonly onOpen: (resource: ResourceRef) => void
}

export const ResourceList = ({ projectName, query, onQuery, onOpen }: Props) => {
  const sessionState = useProjectSessions(projectName, { query })
  const { snapshot } = useAgentRuntime()
  const visible = sessionState.value.items
  const total = sessionState.value.total
  const pageStart = total === 0 ? 0 : (sessionState.page - 1) * 50 + 1
  const pageEnd = pageStart + visible.length - 1
  return (
    <ProjectBrowserFrame
      title="Sessions"
      total={total}
      filtered={total}
      query={query}
      onQuery={onQuery}
      countLabel={String(total)}
    >
      {sessionState.loading && visible.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-muted">Loading Sessions…</div>
      ) : sessionState.error && visible.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-danger" role="status">
          {sessionState.error.message}
        </div>
      ) : visible.length > 0 ? (
        <>
          {sessionState.error && (
            <div className="px-3 py-2 text-xs text-danger" role="status">
              {sessionState.error.message}
            </div>
          )}
          <div aria-busy={sessionState.loading}>
            <SessionRows
              values={visible}
              agents={snapshot.items}
              projectName={projectName}
              onOpen={onOpen}
            />
          </div>
          {(sessionState.hasNewer || sessionState.value.nextCursor) && (
            <nav
              className="mt-2 flex items-center gap-1 border-border border-t px-2 pt-2 text-[0.625rem] text-muted"
              aria-label="Session pages"
            >
              <button
                type="button"
                className="h-7 rounded-sm px-2 hover:bg-hover disabled:opacity-40"
                disabled={!sessionState.hasNewer || sessionState.loading}
                onClick={sessionState.newer}
              >
                Newer
              </button>
              <span className="mx-auto tabular-nums">
                {pageStart}–{pageEnd} of {total}
              </span>
              <button
                type="button"
                className="h-7 rounded-sm px-2 hover:bg-hover disabled:opacity-40"
                disabled={!sessionState.value.nextCursor || sessionState.loading}
                onClick={sessionState.older}
              >
                Older
              </button>
            </nav>
          )}
        </>
      ) : (
        <Empty filtered={query.trim() !== ''} resource="Sessions" />
      )}
    </ProjectBrowserFrame>
  )
}
