import { FileText, MessagesSquare } from 'lucide-react'
import { Markdown } from '../../../components/markdown'
import { issueById, projectByName } from '../../../mock/data'
import { Button } from '../../../ui/button'
import type { ResourceRef } from '../../../workbench/resource'

export const IssueTab = ({
  resource,
  onOpen,
}: {
  readonly resource: Extract<ResourceRef, { type: 'issue' }>
  readonly onOpen: (resource: ResourceRef) => void
}) => {
  const issue = issueById(resource.projectName, resource.issueId)
  const project = projectByName(resource.projectName)
  if (!issue)
    return <p className="grid h-full place-items-center text-muted">Issue is unavailable.</p>

  return (
    <div className="h-full overflow-auto bg-surface">
      <header className="flex min-h-12 items-center gap-2 border-border border-b px-4">
        <span className="text-muted">{project?.name} / Issue /</span>
        <strong>{issue.id.toUpperCase()}</strong>
        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-primary text-xs">
          {issue.status}
        </span>
        <Button className="ml-auto" disabled variant="secondary">
          Edit
        </Button>
      </header>
      <div className="mx-auto grid w-[min(920px,calc(100%_-_48px))] gap-10 py-8 min-[64rem]:grid-cols-[minmax(0,1fr)_230px]">
        <article>
          <p className="mt-0 mb-2 font-mono text-primary text-xs">{issue.id.toUpperCase()}</p>
          <h1 className="m-0 text-balance font-[650] text-2xl tracking-[-0.025em]">
            {issue.title}
          </h1>
          <Markdown text={issue.body} className="mt-7" />
        </article>
        <aside className="border-border border-t pt-4 text-sm min-[64rem]:border-t-0 min-[64rem]:border-l min-[64rem]:pt-0 min-[64rem]:pl-5">
          <dl className="m-0 grid grid-cols-[72px_1fr] gap-y-3">
            <dt className="text-muted">Stage</dt>
            <dd className="m-0">{issue.stage}</dd>
            <dt className="text-muted">Labels</dt>
            <dd className="m-0">{issue.labels.join(', ')}</dd>
          </dl>
          <div className="mt-6 border-border border-t pt-4">
            <p className="mt-0 mb-2 text-xs text-muted">Related resources</p>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm border-0 bg-transparent px-1 py-2 text-left hover:bg-hover [&>svg]:w-4 [&>svg]:flex-none [&>svg]:text-primary"
              onClick={() =>
                onOpen({
                  type: 'session',
                  projectName: issue.projectName,
                  provider: issue.sessionProvider,
                  sessionId: issue.sessionId,
                })
              }
            >
              <MessagesSquare /> Product scan
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm border-0 bg-transparent px-1 py-2 text-left hover:bg-hover [&>svg]:w-4 [&>svg]:flex-none [&>svg]:text-primary"
              onClick={() =>
                onOpen({ type: 'file', projectName: issue.projectName, path: issue.filePath })
              }
            >
              <FileText />
              <span className="min-w-0 truncate">{issue.filePath}</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
