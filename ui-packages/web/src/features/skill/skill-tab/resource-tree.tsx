import type { FileEntry } from '@herdr-roam/shared'
import { ChevronDown, ChevronRight, File, FileText, Folder } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../../ui/button'
import { SectionHeader } from '../../../ui/section-header'
import { treeRowClass } from '../../../ui/tree-row'
import type { ResourceRef } from '../../../workbench/resource'
import { useSkillFiles } from '../use-skill-files'

type SkillResource = Extract<ResourceRef, { type: 'skill' }>

type TreeProps = {
  readonly resource: SkillResource
  readonly selectedPath: string | null
  readonly revision: number
  readonly expanded: ReadonlySet<string>
  readonly onToggle: (path: string) => void
  readonly onSelect: (path: string | null) => void
}

const FileRow = ({
  entry,
  level,
  selected,
  onSelect,
}: {
  readonly entry: FileEntry
  readonly level: number
  readonly selected: boolean
  readonly onSelect: (path: string | null) => void
}) => (
  <button
    type="button"
    className={treeRowClass}
    data-active={selected || undefined}
    style={{ paddingLeft: `${0.5 + level * 0.75}rem` }}
    onClick={() => onSelect(entry.path)}
    title={entry.path}
  >
    <File aria-hidden="true" />
    <span>{entry.name}</span>
  </button>
)

const DirectoryChildren = ({
  directory,
  level,
  ...props
}: TreeProps & {
  readonly directory: string
  readonly level: number
}) => {
  const state = useSkillFiles(props.resource, directory, props.revision)
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
            selected={entry.path === props.selectedPath}
            onSelect={props.onSelect}
          />
        ),
      )}
      {state.loading && state.items.length === 0 && (
        <p className="m-0 flex min-h-7 items-center pl-2 text-2xs text-faint">Loading…</p>
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

const DirectoryRow = ({
  entry,
  level,
  ...props
}: TreeProps & {
  readonly entry: FileEntry
  readonly level: number
}) => {
  const open = props.expanded.has(entry.path)
  return (
    <div>
      <button
        type="button"
        className={treeRowClass}
        style={{ paddingLeft: `${0.5 + level * 0.75}rem` }}
        onClick={() => props.onToggle(entry.path)}
        aria-expanded={open}
        title={entry.path}
      >
        {open ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        <Folder aria-hidden="true" />
        <span>{entry.name}</span>
      </button>
      {open && <DirectoryChildren directory={entry.path} level={level + 1} {...props} />}
    </div>
  )
}

export const ResourceTree = ({
  resource,
  selectedPath,
  revision,
  onSelect,
}: {
  readonly resource: SkillResource
  readonly selectedPath: string | null
  readonly revision: number
  readonly onSelect: (path: string | null) => void
}) => {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const root = useSkillFiles(resource, '', revision)
  const toggle = (path: string) =>
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  const props: TreeProps = {
    resource,
    selectedPath,
    revision,
    expanded,
    onToggle: toggle,
    onSelect,
  }

  return (
    <aside
      className="min-h-0 overflow-auto border-border border-l bg-[color-mix(in_oklab,var(--sidebar)_55%,var(--surface))] px-2 pt-4 pb-8 @max-[54rem]:row-start-1 @max-[54rem]:max-h-48 @max-[54rem]:border-b @max-[54rem]:border-l-0 @max-[54rem]:py-3"
      aria-label="Skill contents"
    >
      <SectionHeader title="Contents" className="mb-1" />
      <button
        type="button"
        className={treeRowClass}
        data-active={selectedPath === null || undefined}
        onClick={() => onSelect(null)}
      >
        <FileText aria-hidden="true" />
        <span>Overview</span>
      </button>
      <div aria-busy={root.loading}>
        {root.items.map(entry =>
          entry.kind === 'directory' ? (
            <DirectoryRow key={entry.path} entry={entry} level={0} {...props} />
          ) : (
            <FileRow
              key={entry.path}
              entry={entry}
              level={0}
              selected={entry.path === selectedPath}
              onSelect={onSelect}
            />
          ),
        )}
        {root.loading && root.items.length === 0 && (
          <p className="m-0 flex min-h-7 items-center pl-2 text-2xs text-faint">Loading…</p>
        )}
        {root.error && (
          <Button size="compact" className="w-full text-danger" onClick={root.retry}>
            Retry contents
          </Button>
        )}
        {root.nextCursor && (
          <Button size="compact" className="w-full" onClick={root.loadMore}>
            Load more
          </Button>
        )}
      </div>
    </aside>
  )
}
