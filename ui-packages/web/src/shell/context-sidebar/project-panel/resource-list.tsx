import type { AgentStatus, AgentSummary, SessionSummary } from '@herdr-roam/shared'
import type { ReactNode } from 'react'
import { useAgentRuntime } from '../../../features/agent/runtime-provider'
import { StatusDot } from '../../../features/agent/status-dot'
import { useProjectSessions } from '../../../features/session/use-session-data'
import { Banner } from '../../../ui/banner'
import { Button } from '../../../ui/button'
import { EmptyState } from '../../../ui/empty-state'
import { SearchField } from '../../../ui/search-field'
import type { ResourceRef } from '../../../workbench/resource'

type BrowserFrameProps = {
  readonly title: string
  readonly total: number
  readonly filtered: number
  readonly query: string
  readonly onQuery: (query: string) => void
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
        <SearchField
          className="flex-1"
          label={`Search ${title.toLowerCase()}`}
          placeholder={`Search ${title.toLowerCase()}…`}
          value={query}
          onChange={event => onQuery(event.target.value)}
          trailing={resolvedCountLabel}
        />
        {actions}
      </fieldset>
      <div className="min-h-0 flex-1 overflow-auto px-1.75 pb-3.5">{children}</div>
    </section>
  )
}

const Status = ({ value }: { readonly value: AgentStatus | 'not-running' }) => (
  <StatusDot
    status={value === 'not-running' ? null : value}
    label={value}
    className="mt-[0.3rem]"
  />
)

const Empty = ({
  filtered,
  resource,
}: {
  readonly filtered: boolean
  readonly resource: string
}) => (
  <EmptyState title={filtered ? `No matching ${resource}` : `No ${resource} yet`}>
    {filtered ? 'Try a different search.' : `This project has no ${resource} to show.`}
  </EmptyState>
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
            className="flex min-h-12 w-full min-w-0 items-start gap-2.5 rounded-sm border-0 bg-transparent px-2 py-2.25 text-left text-foreground hover:bg-hover [&>span]:grid [&>span]:min-w-0 [&>span]:flex-1 [&>span]:gap-0.75 [&_small]:truncate [&_small]:text-2xs [&_small]:text-faint [&_strong]:truncate [&_strong]:text-xs [&_strong]:font-semibold"
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
        <p className="m-0 px-4 py-8 text-center text-xs text-muted" role="status">
          Loading Sessions…
        </p>
      ) : sessionState.error && visible.length === 0 ? (
        <EmptyState title="Sessions unavailable" role="status">
          {sessionState.error.message}
        </EmptyState>
      ) : visible.length > 0 ? (
        <>
          {sessionState.error && (
            <Banner tone="danger" inset className="mx-1 mb-1">
              {sessionState.error.message}
            </Banner>
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
              className="mt-2 flex items-center gap-1 border-border border-t px-2 pt-2 text-2xs text-muted"
              aria-label="Session pages"
            >
              <Button
                size="compact"
                disabled={!sessionState.hasNewer || sessionState.loading}
                onClick={sessionState.newer}
              >
                Newer
              </Button>
              <span className="mx-auto tabular-nums">
                {pageStart}–{pageEnd} of {total}
              </span>
              <Button
                size="compact"
                disabled={!sessionState.value.nextCursor || sessionState.loading}
                onClick={sessionState.older}
              >
                Older
              </Button>
            </nav>
          )}
        </>
      ) : (
        <Empty filtered={query.trim() !== ''} resource="Sessions" />
      )}
    </ProjectBrowserFrame>
  )
}
