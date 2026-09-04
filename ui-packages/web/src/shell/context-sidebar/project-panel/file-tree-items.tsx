import type { ProjectFileEntry } from '@herdr-roam/shared'
import { ChevronDown, ChevronRight, File, Folder } from 'lucide-react'
import { useFileCatalog } from '../../../features/file/use-file-catalog'
import type { ResourceRef } from '../../../workbench/resource'
import styles from './style.module.scss'

export type TreeProps = {
  readonly projectName: string
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
  onOpen,
}: {
  readonly entry: ProjectFileEntry
  readonly level: number
  readonly active: boolean
  readonly projectName: string
  readonly onOpen: (resource: ResourceRef) => void
}) => (
  <button
    type="button"
    className={styles.row}
    data-active={active || undefined}
    style={{ paddingLeft: `${0.5 + level * 0.875}rem` }}
    onClick={() => onOpen({ type: 'file', projectName, path: entry.path })}
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
        className={styles.row}
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
            onOpen={props.onOpen}
          />
        ),
      )}
      {state.loading && state.items.length === 0 && (
        <div className={styles.inlineStatus} style={{ paddingLeft: `${0.75 + level * 0.875}rem` }}>
          Loading…
        </div>
      )}
      {state.error && (
        <button type="button" className={styles.inlineError} onClick={state.retry}>
          Retry directory
        </button>
      )}
      {state.nextCursor && (
        <button type="button" className={styles.more} onClick={state.loadMore}>
          Load more
        </button>
      )}
    </div>
  )
}
