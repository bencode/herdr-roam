import type { IssueStatus, IssueSummary } from '@herdr-roam/shared'
import { CircleDot, RefreshCw } from 'lucide-react'
import { useDeferredValue } from 'react'
import { useIssueCatalog } from '../../../features/issue/use-issue-data'
import type { ProjectWorkspaceState } from '../../../features/project/use-project-workspaces'
import { cn } from '../../../lib/cn'
import type { ResourceRef } from '../../../workbench/resource'
import { ProjectBrowserFrame } from './resource-list'
import styles from './style.module.scss'
import { WorkspaceSelect } from './workspace-select'

type IssueResource = Extract<ResourceRef, { type: 'issue' }>

const statusClasses: Readonly<Record<IssueStatus, string>> = {
  open: 'text-primary',
  closed: 'text-success',
}

const matches = (issue: IssueSummary, query: string): boolean => {
  const normalized = query.trim().toLowerCase()
  return (
    normalized === '' ||
    [issue.id, issue.title, issue.type ?? '', issue.priority ?? '', ...issue.labels].some(value =>
      value.toLowerCase().includes(normalized),
    )
  )
}

const IssueRows = ({
  title,
  items,
  active,
  projectName,
  workspaceId,
  onOpen,
}: {
  readonly title: string
  readonly items: readonly IssueSummary[]
  readonly active: IssueResource | null
  readonly projectName: string
  readonly workspaceId: string
  readonly onOpen: (resource: ResourceRef) => void
}) => {
  if (items.length === 0) return null
  return (
    <section aria-label={`${title} Issues`}>
      <h2 className="m-0 px-2 pt-3 pb-1 text-[0.625rem] font-semibold text-muted">
        {title} <span className="font-normal tabular-nums">{items.length}</span>
      </h2>
      <div className="grid gap-px">
        {items.map(issue => (
          <button
            type="button"
            key={issue.id}
            data-active={
              active?.workspaceId === workspaceId && active.issueId === issue.id ? true : undefined
            }
            className="flex min-h-12 w-full min-w-0 items-start gap-2.5 rounded-sm border-0 bg-transparent px-2 py-2.25 text-left text-foreground hover:bg-hover data-[active]:bg-primary-soft [&>span]:grid [&>span]:min-w-0 [&>span]:flex-1 [&>span]:gap-0.75 [&_small]:truncate [&_small]:text-[0.625rem] [&_small]:text-faint [&_strong]:truncate [&_strong]:text-xs [&_strong]:font-semibold"
            onClick={() => onOpen({ type: 'issue', projectName, workspaceId, issueId: issue.id })}
            title={`${issue.id} · ${issue.title}`}
          >
            <CircleDot
              className={cn('mt-0.5 w-3 flex-none', statusClasses[issue.status])}
              aria-hidden="true"
            />
            <span>
              <strong>{issue.title}</strong>
              <small>
                {issue.id.slice(0, 8)}
                {issue.type && ` · ${issue.type}`}
                {issue.priority && ` · ${issue.priority}`}
              </small>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

const Empty = ({ query }: { readonly query: string }) => (
  <div className={styles.empty}>
    <strong>{query.trim() ? 'No matching Issues' : 'No Issues yet'}</strong>
    <span>
      {query.trim() ? 'Try a different search.' : 'Ask an Agent to create the first Issue.'}
    </span>
  </div>
)

export const IssueBrowser = ({
  projectName,
  workspaceId,
  workspaces,
  activeIssue,
  query,
  onQuery,
  onWorkspace,
  onOpen,
}: {
  readonly projectName: string
  readonly workspaceId: string
  readonly workspaces: ProjectWorkspaceState
  readonly activeIssue: IssueResource | null
  readonly query: string
  readonly onQuery: (query: string) => void
  readonly onWorkspace: (workspaceId: string) => void
  readonly onOpen: (resource: ResourceRef) => void
}) => {
  const deferredQuery = useDeferredValue(query)
  const state = useIssueCatalog(projectName, workspaceId)
  const visible = state.value.items.filter(issue => matches(issue, deferredQuery))
  const open = visible.filter(issue => issue.status === 'open')
  const closed = visible.filter(issue => issue.status === 'closed')
  const notConfigured = state.error?.code === 'issue_store_not_configured'

  return (
    <ProjectBrowserFrame
      title="Issues"
      total={state.value.items.length}
      filtered={visible.length}
      query={query}
      onQuery={onQuery}
      leading={
        workspaces.items.length > 1 ? (
          <WorkspaceSelect
            items={workspaces.items}
            value={workspaceId}
            label="Issue directory"
            onValueChange={onWorkspace}
          />
        ) : null
      }
      actions={
        <button
          type="button"
          className={styles.refresh}
          onClick={() => {
            workspaces.retry()
            state.reload()
          }}
          disabled={state.loading}
          aria-label="Refresh Issues"
          title="Refresh Issues"
        >
          <RefreshCw aria-hidden="true" />
        </button>
      }
    >
      {workspaces.error && workspaces.items.length === 0 ? (
        <div className={styles.empty} role="status">
          <strong>Directories unavailable</strong>
          <span>{workspaces.error.message}</span>
          <button type="button" onClick={workspaces.retry}>
            Try again
          </button>
        </div>
      ) : state.loading && state.value.items.length === 0 ? (
        <div className="grid gap-1.5 px-2 py-3" role="status" aria-label="Loading Issues">
          {[0, 1, 2].map(value => (
            <div
              key={value}
              className="h-11 animate-pulse rounded-sm bg-hover motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : notConfigured ? (
        <div className={styles.empty} role="status">
          <strong>Issue store not configured</strong>
          <span>
            Add `.herdr-roam.json`, or ask an Agent with herdr-roam-issues to initialize it.
          </span>
        </div>
      ) : state.error && state.value.items.length === 0 ? (
        <div className={styles.empty} role="status">
          <strong>Issues unavailable</strong>
          <span>{state.error.message}</span>
          <button type="button" onClick={state.reload}>
            Try again
          </button>
        </div>
      ) : (
        <div aria-busy={state.loading}>
          {state.error && (
            <div className="px-3 py-2 text-xs text-danger" role="status">
              {state.error.message}
            </div>
          )}
          {state.value.warnings.length > 0 && (
            <details className="mx-2 mt-2 rounded-sm bg-hover px-2 py-1.5 text-[0.6875rem] text-warning">
              <summary>{state.value.warnings.length} Issue files could not be read</summary>
              <ul className="mb-1 pl-4 text-muted">
                {state.value.warnings.map(warning => (
                  <li key={warning.path}>
                    <code>{warning.path}</code>: {warning.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {visible.length === 0 ? (
            <Empty query={deferredQuery} />
          ) : (
            <>
              <IssueRows
                title="Open"
                items={open}
                active={activeIssue}
                projectName={projectName}
                workspaceId={workspaceId}
                onOpen={onOpen}
              />
              <IssueRows
                title="Closed"
                items={closed}
                active={activeIssue}
                projectName={projectName}
                workspaceId={workspaceId}
                onOpen={onOpen}
              />
            </>
          )}
        </div>
      )}
    </ProjectBrowserFrame>
  )
}
