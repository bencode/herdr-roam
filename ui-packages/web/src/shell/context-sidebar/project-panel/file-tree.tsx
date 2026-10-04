import { RefreshCw } from 'lucide-react'
import { useDeferredValue, useEffect, useState } from 'react'
import { useFileCatalog } from '../../../features/file/use-file-catalog'
import { useFileSearch } from '../../../features/file/use-file-search'
import type { ProjectWorkspaceState } from '../../../features/project/use-project-workspaces'
import { Button } from '../../../ui/button'
import { EmptyState } from '../../../ui/empty-state'
import type { ResourceRef } from '../../../workbench/resource'
import type { TreeProps } from './file-tree-items'
import { DirectoryRow, FileRow } from './file-tree-items'
import { ProjectBrowserFrame } from './resource-list'

type FileResource = Extract<ResourceRef, { type: 'file' }>

const parentDirectories = (path: string): readonly string[] =>
  path
    .split('/')
    .slice(0, -1)
    .map((_, index, parts) => parts.slice(0, index + 1).join('/'))

export const FileTree = ({
  projectName,
  activeFile,
  workspaceId,
  workspaces,
  query,
  onQuery,
  onOpen,
}: {
  readonly projectName: string
  readonly activeFile: FileResource | null
  readonly workspaceId: string
  readonly workspaces: ProjectWorkspaceState
  readonly query: string
  readonly onQuery: (query: string) => void
  readonly onOpen: (resource: ResourceRef) => void
}) => {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [revision, setRevision] = useState(0)
  const deferredQuery = useDeferredValue(query.trim())
  const activePath = activeFile?.workspaceId === workspaceId ? activeFile.path : null
  const root = useFileCatalog({ projectName, workspaceId })
  const search = useFileSearch({ projectName, workspaceId, query: deferredQuery })
  const searching = deferredQuery !== ''
  const items = searching ? search.items : root.items
  const loading = searching ? search.searching : root.loading
  const error = searching ? search.error : root.error
  const retry = searching ? search.retry : root.retry
  const resultCount = `${search.items.length}${search.truncated ? '+' : ''}`

  useEffect(() => {
    if (!activePath) return
    setExpanded(current => new Set([...current, ...parentDirectories(activePath)]))
  }, [activePath])

  const toggle = (path: string) =>
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const treeProps: TreeProps = {
    projectName,
    workspaceId,
    activePath,
    expanded,
    revision,
    onFolder: toggle,
    onOpen,
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ProjectBrowserFrame
        title="Files"
        total={root.total}
        filtered={search.items.length}
        query={query}
        onQuery={onQuery}
        countLabel={
          searching
            ? `${resultCount} ${search.items.length === 1 ? 'result' : 'results'}${search.searching ? '…' : search.error ? ' · interrupted' : ''}`
            : null
        }
        actions={
          <Button
            size="defaultIcon"
            onClick={() => {
              workspaces.retry()
              retry()
              setRevision(value => value + 1)
            }}
            disabled={loading}
            aria-label="Refresh files"
            title="Refresh files"
          >
            <RefreshCw aria-hidden="true" />
          </Button>
        }
      >
        {workspaces.error && workspaces.items.length === 0 ? (
          <EmptyState
            title="Directories unavailable"
            role="status"
            action={
              <Button size="compact" variant="secondary" onClick={workspaces.retry}>
                Try again
              </Button>
            }
          >
            {workspaces.error.message}
          </EmptyState>
        ) : items.length > 0 ? (
          <div className="pt-0.5" aria-busy={loading}>
            {items.map(entry =>
              entry.kind === 'directory' && !searching ? (
                <DirectoryRow key={entry.path} entry={entry} level={0} {...treeProps} />
              ) : (
                <FileRow
                  key={entry.path}
                  entry={entry}
                  level={0}
                  active={entry.path === activePath}
                  projectName={projectName}
                  workspaceId={workspaceId}
                  onOpen={onOpen}
                />
              ),
            )}
            {!searching && root.nextCursor && (
              <Button size="compact" className="w-full" onClick={root.loadMore}>
                Load more
              </Button>
            )}
          </div>
        ) : loading || workspaces.loading ? (
          <p className="m-0 px-4 py-8 text-center text-xs text-muted" role="status">
            {searching ? 'Searching Files…' : 'Loading Files…'}
          </p>
        ) : error ? (
          <EmptyState
            title="Files unavailable"
            role="status"
            action={
              <Button size="compact" variant="secondary" onClick={retry}>
                Try again
              </Button>
            }
          >
            {error.message}
          </EmptyState>
        ) : (
          <EmptyState title={deferredQuery ? 'No matching Files' : 'No Files to show'}>
            {deferredQuery ? 'Try a different path.' : 'This Project directory is empty.'}
          </EmptyState>
        )}
      </ProjectBrowserFrame>
    </div>
  )
}
