import { CircleDot, RefreshCw } from 'lucide-react'
import { Markdown } from '../../../components/markdown'
import { cn } from '../../../lib/cn'
import type { ResourceRef } from '../../../workbench/resource'
import { useIssueDetail } from '../use-issue-data'

export const IssueTab = ({
  resource,
  active,
}: {
  readonly resource: Extract<ResourceRef, { type: 'issue' }>
  readonly active: boolean
}) => {
  const state = useIssueDetail(resource.projectName, resource.workspaceId, resource.issueId, active)
  const issue = state.value

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex min-h-12 flex-none items-center gap-2 border-border border-b px-4">
        <CircleDot className="w-4 flex-none text-primary" aria-hidden="true" />
        <strong className="font-mono text-xs">{resource.issueId.slice(0, 8)}</strong>
        {issue && (
          <span className="min-w-0 truncate text-xs text-muted" title={issue.path}>
            {issue.path}
          </span>
        )}
        <button
          type="button"
          className="ml-auto grid size-8 flex-none place-items-center rounded-sm border-0 bg-transparent text-muted hover:bg-hover hover:text-foreground disabled:opacity-40 [&>svg]:w-3.5"
          onClick={state.reload}
          disabled={state.loading}
          aria-label="Refresh Issue"
          title="Refresh Issue"
        >
          <RefreshCw aria-hidden="true" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto" aria-busy={state.loading}>
        {state.loading && !issue ? (
          <div
            className="mx-auto grid w-[min(52rem,calc(100%_-_3rem))] gap-3 py-9"
            role="status"
            aria-label="Loading Issue"
          >
            <div className="h-8 w-3/4 animate-pulse rounded-sm bg-hover motion-reduce:animate-none" />
            <div className="h-5 w-2/5 animate-pulse rounded-sm bg-hover motion-reduce:animate-none" />
            <div className="mt-5 h-40 animate-pulse rounded-sm bg-hover motion-reduce:animate-none" />
          </div>
        ) : state.error && !issue ? (
          <div className="grid h-full place-items-center p-8 text-center" role="status">
            <div className="grid max-w-sm gap-2">
              <strong>Issue unavailable</strong>
              <span className="text-sm text-muted">{state.error.message}</span>
              <button
                type="button"
                className="mx-auto mt-2 h-8 rounded-sm bg-hover px-3 text-sm"
                onClick={state.reload}
              >
                Try again
              </button>
            </div>
          </div>
        ) : issue ? (
          <article className="mx-auto w-[min(52rem,calc(100%_-_3rem))] py-9">
            {state.error && (
              <div className="mb-5 text-sm text-danger" role="status">
                {state.error.message}
              </div>
            )}
            <h1 className="m-0 text-balance font-[650] text-2xl tracking-[-0.025em]">
              {issue.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span
                className={cn(
                  'rounded-full px-2 py-0.5',
                  issue.status === 'open'
                    ? 'bg-primary-soft text-primary'
                    : 'bg-hover text-success',
                )}
              >
                {issue.status}
              </span>
              {issue.type && <span className="text-muted">{issue.type}</span>}
              {issue.priority && <span className="font-mono text-muted">{issue.priority}</span>}
              {issue.labels.map(label => (
                <span key={label} className="rounded-full bg-hover px-2 py-0.5 text-muted">
                  {label}
                </span>
              ))}
            </div>
            <Markdown text={issue.body} className="mt-7" />
          </article>
        ) : null}
      </div>
    </div>
  )
}
