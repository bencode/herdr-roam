import { RefreshCw } from 'lucide-react'
import { useDeferredValue, useEffect, useState } from 'react'
import { useFileCatalog } from '../../../features/file/use-file-catalog'
import type { ProjectWorkspaceState } from '../../../features/project/use-project-workspaces'
import type { ResourceRef } from '../../../workbench/resource'
import type { TreeProps } from './file-tree-items'
import { DirectoryRow, FileRow } from './file-tree-items'
import { ProjectBrowserFrame } from './resource-list'
import styles from './style.module.scss'
import { WorkspaceSelect } from './workspace-select'

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
  onWorkspace,
  onOpen,
}: {
  readonly projectName: string
  readonly activeFile: FileResource | null
  readonly workspaceId: string
  readonly workspaces: ProjectWorkspaceState
  readonly query: string
  readonly onQuery: (query: string) => void
  readonly onWorkspace: (workspaceId: string) => void
  readonly onOpen: (resource: ResourceRef) => void
}) => {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [revision, setRevision] = useState(0)
  const deferredQuery = useDeferredValue(query.trim())
  const activePath = activeFile?.workspaceId === workspaceId ? activeFile.path : null
  const root = useFileCatalog({ projectName, workspaceId, query: deferredQuery })

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

  const selectWorkspace = (nextWorkspaceId: string) => {
    onWorkspace(nextWorkspaceId)
    setExpanded(new Set())
    setRevision(value => value + 1)
  }

  return (
    <div className={styles.fileBrowser}>
      <ProjectBrowserFrame
        title="Files"
        total={root.total}
        filtered={root.total}
        query={query}
        onQuery={onQuery}
        leading={
          workspaces.items.length > 1 ? (
            <WorkspaceSelect
              items={workspaces.items}
              value={workspaceId}
              onValueChange={selectWorkspace}
            />
          ) : null
        }
        countLabel={
          deferredQuery === '' ? null : `${root.total} ${root.total === 1 ? 'result' : 'results'}`
        }
        actions={
          <button
            type="button"
            className={styles.refresh}
            onClick={() => {
              workspaces.retry()
              root.retry()
              setRevision(value => value + 1)
            }}
            disabled={root.loading}
            aria-label="Refresh files"
            title="Refresh files"
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
        ) : root.items.length > 0 ? (
          <div className={styles.tree} aria-busy={root.loading}>
            {root.items.map(entry =>
              entry.kind === 'directory' && deferredQuery === '' ? (
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
            {root.nextCursor && (
              <button type="button" className={styles.more} onClick={root.loadMore}>
                Load more
              </button>
            )}
          </div>
        ) : root.loading || workspaces.loading ? (
          <div className={styles.empty}>Loading Files…</div>
        ) : root.error ? (
          <div className={styles.empty} role="status">
            <strong>Files unavailable</strong>
            <span>{root.error.message}</span>
            <button type="button" onClick={root.retry}>
              Try again
            </button>
          </div>
        ) : (
          <div className={styles.empty}>
            <strong>{deferredQuery ? 'No matching Files' : 'No Files to show'}</strong>
            <span>
              {deferredQuery ? 'Try a different path.' : 'This Project directory is empty.'}
            </span>
          </div>
        )}
      </ProjectBrowserFrame>
    </div>
  )
}
