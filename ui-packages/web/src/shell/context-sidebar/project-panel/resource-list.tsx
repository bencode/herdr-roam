import { CircleDot, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../../lib/cn'
import type { AgentStatus, Issue, Loop, LoopStatus, Session } from '../../../mock/data'
import { issues, loops, projectByName, sessions } from '../../../mock/data'
import type { ResourceRef } from '../../../workbench/resource'

const statusClasses: Readonly<Record<AgentStatus | LoopStatus, string>> = {
  working: 'bg-primary',
  blocked: 'bg-warning',
  idle: 'bg-primary',
  done: 'bg-success',
  enabled: 'bg-primary',
  paused: 'bg-faint',
  error: 'bg-danger',
}

const issueStatusClasses: Readonly<Record<Issue['status'], string>> = {
  open: 'text-primary',
  closed: 'text-success',
}

export type ProjectSection = 'sessions' | 'issues' | 'loops' | 'files'

type BrowserFrameProps = {
  readonly title: string
  readonly total: number
  readonly filtered: number
  readonly query: string
  readonly onQuery: (query: string) => void
  readonly children: ReactNode
}

export const ProjectBrowserFrame = ({
  title,
  total,
  filtered,
  query,
  onQuery,
  children,
}: BrowserFrameProps) => (
  <section className="flex min-h-0 flex-1 flex-col" aria-label={`${title} browser`}>
    <div className="flex-none bg-sidebar px-2.5 py-2">
      <label className="flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-2 transition-[border-color,box-shadow] duration-150 focus-within:border-primary focus-within:shadow-[0_0_0_1px_var(--primary)] [&>svg]:w-3.5 [&>svg]:flex-none [&>svg]:text-faint">
        <Search aria-hidden="true" />
        <span className="sr-only">Search {title.toLowerCase()}</span>
        <input
          className="min-w-0 flex-1 border-0 bg-transparent text-xs outline-none! placeholder:text-faint"
          aria-label={`Search ${title.toLowerCase()}`}
          value={query}
          onChange={event => onQuery(event.target.value)}
          placeholder={`Search ${title.toLowerCase()}…`}
        />
        <span className="flex-none text-[0.625rem] text-muted tabular-nums" aria-live="polite">
          {query.trim() === '' ? total : `${filtered}/${total}`}
        </span>
      </label>
    </div>
    <div className="min-h-0 flex-1 overflow-auto px-1.75 pb-3.5">{children}</div>
  </section>
)

const matches = (query: string, ...values: readonly string[]): boolean => {
  const normalized = query.trim().toLowerCase()
  return normalized === '' || values.some(value => value.toLowerCase().includes(normalized))
}

const Status = ({ value }: { readonly value: AgentStatus }) => (
  <i
    className={cn('mt-[0.3rem] size-1.5 flex-none rounded-full', statusClasses[value])}
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
  onOpen,
}: {
  readonly values: readonly Session[]
  readonly onOpen: (resource: ResourceRef) => void
}) => (
  <div className="grid gap-px">
    {values.map(session => (
      <button
        type="button"
        key={session.id}
        className="flex min-h-12 w-full min-w-0 items-start gap-2.5 rounded-sm border-0 bg-transparent px-2 py-2.25 text-left text-foreground hover:bg-hover [&>span]:grid [&>span]:min-w-0 [&>span]:flex-1 [&>span]:gap-0.75 [&_small]:truncate [&_small]:text-[0.625rem] [&_small]:text-faint [&_strong]:truncate [&_strong]:text-xs [&_strong]:font-semibold"
        onClick={() =>
          onOpen({ type: 'session', projectName: session.projectName, sessionId: session.id })
        }
        title={session.title}
      >
        <Status value={session.status} />
        <span>
          <strong>{session.title}</strong>
          <small>
            {session.provider} · {session.updated}
          </small>
        </span>
      </button>
    ))}
  </div>
)

const IssueRows = ({
  values,
  onOpen,
}: {
  readonly values: readonly Issue[]
  readonly onOpen: (resource: ResourceRef) => void
}) => (
  <div className="grid gap-px">
    {values.map(issue => (
      <button
        type="button"
        key={issue.id}
        className="flex min-h-12 w-full min-w-0 items-start gap-2.5 rounded-sm border-0 bg-transparent px-2 py-2.25 text-left text-foreground hover:bg-hover [&>span]:grid [&>span]:min-w-0 [&>span]:flex-1 [&>span]:gap-0.75 [&_small]:truncate [&_small]:text-[0.625rem] [&_small]:text-faint [&_strong]:truncate [&_strong]:text-xs [&_strong]:font-semibold"
        onClick={() => onOpen({ type: 'issue', projectName: issue.projectName, issueId: issue.id })}
        title={`${issue.id.toUpperCase()} · ${issue.title}`}
      >
        <CircleDot
          className={cn('mt-0.5 w-3 flex-none', issueStatusClasses[issue.status])}
          aria-hidden="true"
        />
        <span>
          <strong>{issue.title}</strong>
          <small>
            {issue.id.toUpperCase()} · {issue.stage}
          </small>
        </span>
      </button>
    ))}
  </div>
)

const LoopRows = ({ values }: { readonly values: readonly Loop[] }) => (
  <div className="grid gap-px">
    {values.map(loop => (
      <div
        key={loop.id}
        className="flex min-h-12 w-full min-w-0 items-start gap-2.5 rounded-sm border-0 bg-transparent px-2 py-2.25 text-left text-foreground [&>span]:grid [&>span]:min-w-0 [&>span]:flex-1 [&>span]:gap-0.75 [&_small]:truncate [&_small]:text-[0.625rem] [&_small]:text-faint [&_strong]:truncate [&_strong]:text-xs [&_strong]:font-semibold"
        title={loop.title}
      >
        <i
          className={cn('mt-[0.3rem] size-1.5 flex-none rounded-full', statusClasses[loop.status])}
          role="img"
          aria-label={loop.status}
        />
        <span>
          <strong>{loop.title}</strong>
          <small>
            {loop.schedule} · {loop.nextRun}
          </small>
        </span>
      </div>
    ))}
  </div>
)

type Props = {
  readonly section: Exclude<ProjectSection, 'files'>
  readonly projectName: string
  readonly query: string
  readonly onQuery: (query: string) => void
  readonly onOpen: (resource: ResourceRef) => void
}

export const ResourceList = ({ section, projectName, query, onQuery, onOpen }: Props) => {
  if (section === 'sessions') {
    const all = sessions.filter(session => session.projectName === projectName)
    const visible = all.filter(session =>
      matches(query, session.title, session.provider, session.status),
    )
    return (
      <ProjectBrowserFrame
        title="Sessions"
        total={all.length}
        filtered={visible.length}
        query={query}
        onQuery={onQuery}
      >
        {visible.length > 0 ? (
          <SessionRows values={visible} onOpen={onOpen} />
        ) : (
          <Empty filtered={all.length > 0} resource="Sessions" />
        )}
      </ProjectBrowserFrame>
    )
  }

  if (section === 'issues') {
    const project = projectByName(projectName)
    const all = issues.filter(issue => issue.projectName === projectName)
    const visible = all.filter(issue =>
      matches(query, issue.id, issue.title, issue.stage, ...issue.labels),
    )
    return (
      <ProjectBrowserFrame
        title="Issues"
        total={all.length}
        filtered={visible.length}
        query={query}
        onQuery={onQuery}
      >
        {!project?.issuesConfigured ? (
          <div className="grid justify-items-center gap-1 px-4 py-8 text-center text-muted [&>span]:max-w-52 [&>span]:text-[0.6875rem] [&>span]:leading-normal [&>strong]:text-xs [&>strong]:text-foreground">
            <strong>Issue store not configured</strong>
            <span>This project does not use the optional Roam Issue convention.</span>
          </div>
        ) : visible.length > 0 ? (
          <IssueRows values={visible} onOpen={onOpen} />
        ) : (
          <Empty filtered={all.length > 0} resource="Issues" />
        )}
      </ProjectBrowserFrame>
    )
  }

  const all = loops.filter(loop => loop.projectName === projectName)
  const visible = all.filter(loop =>
    matches(query, loop.title, loop.status, loop.schedule, loop.nextRun),
  )
  return (
    <ProjectBrowserFrame
      title="Loops"
      total={all.length}
      filtered={visible.length}
      query={query}
      onQuery={onQuery}
    >
      {visible.length > 0 ? (
        <LoopRows values={visible} />
      ) : (
        <Empty filtered={all.length > 0} resource="Loops" />
      )}
    </ProjectBrowserFrame>
  )
}
