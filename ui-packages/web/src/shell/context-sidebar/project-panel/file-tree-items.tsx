import type { ProjectFileEntry } from '@herdr-roam/shared'
import { ChevronDown, ChevronRight, File, Folder } from 'lucide-react'
import { useFileCatalog } from '../../../features/file/use-file-catalog'
import { Button } from '../../../ui/button'
import type { ResourceRef } from '../../../workbench/resource'

const rowClass =
  'flex h-(--control-sm) w-full min-w-0 items-center gap-1.5 rounded-sm border-0 bg-transparent pr-1.75 text-left text-xs text-muted hover:bg-hover hover:text-foreground data-active:bg-primary-soft data-active:text-foreground [&>span]:min-w-0 [&>span]:truncate [&>svg]:w-3.25 [&>svg]:flex-none'

export type TreeProps = {
  readonly projectName: string
  readonly workspaceId: string
  readonly activePath: string | null
  readonly expanded: ReadonlySet<string>
  readonly revision: number
  readonly onFolder: (path: string) => void
  readonly onOpen: (resource: ResourceRef) => void
}

export const FileRow = ({
  entry,
  level,
  active,
  projectName,
  workspaceId,
  onOpen,
}: {
  readonly entry: ProjectFileEntry
  readonly level: number
  readonly active: boolean
  readonly projectName: string
  readonly workspaceId: string
  readonly onOpen: (resource: ResourceRef) => void
}) => (
  <button
    type="button"
    className={rowClass}
    data-active={active || undefined}
    style={{ paddingLeft: `${0.5 + level * 0.875}rem` }}
    onClick={() => onOpen({ type: 'file', projectName, workspaceId, path: entry.path })}
    title={entry.path}
  >
    <File aria-hidden="true" />
    <span>{entry.name}</span>
  </button>
)

export const DirectoryRow = ({
  entry,
  level,
  ...props
}: TreeProps & { readonly entry: ProjectFileEntry; readonly level: number }) => {
  const open = props.expanded.has(entry.path)
  return (
    <div>
      <button
        type="button"
        className={rowClass}
        style={{ paddingLeft: `${0.5 + level * 0.875}rem` }}
        onClick={() => props.onFolder(entry.path)}
        aria-expanded={open}
        title={entry.path}
      >
        {open ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        <Folder aria-hidden="true" />
        <span>{entry.name}</span>
      </button>
      {open && (
        <DirectoryChildren
          key={props.revision}
          directory={entry.path}
          level={level + 1}
          {...props}
        />
      )}
    </div>
  )
}

const DirectoryChildren = ({
  directory,
  level,
  ...props
}: TreeProps & { readonly directory: string; readonly level: number }) => {
  const state = useFileCatalog({
    projectName: props.projectName,
    workspaceId: props.workspaceId,
    directory,
  })
  return (
    <div aria-busy={state.loading}>
      {state.items.map(entry =>
        entry.kind === 'directory' ? (
          <DirectoryRow key={entry.path} entry={entry} level={level} {...props} />
        ) : (
          <FileRow
            key={entry.path}
            entry={entry}
            level={level}
            active={entry.path === props.activePath}
            projectName={props.projectName}
            workspaceId={props.workspaceId}
            onOpen={props.onOpen}
          />
        ),
      )}
      {state.loading && state.items.length === 0 && (
        <div
          className="flex min-h-7 items-center text-2xs text-faint"
          style={{ paddingLeft: `${0.75 + level * 0.875}rem` }}
        >
          Loading…
        </div>
      )}
      {state.error && (
        <Button size="compact" className="w-full text-danger" onClick={state.retry}>
          Retry directory
        </Button>
      )}
      {state.nextCursor && (
        <Button size="compact" className="w-full" onClick={state.loadMore}>
          Load more
        </Button>
      )}
    </div>
  )
}
