import { ChevronDown, ChevronRight, File, Folder } from 'lucide-react'
import { useState } from 'react'
import type { FileResource } from '../../../mock/data'
import { files } from '../../../mock/data'
import type { ResourceRef } from '../../../workbench/resource'
import { ProjectBrowserFrame } from './resource-list'

type FileNode = {
  readonly kind: 'file'
  readonly name: string
  readonly path: string
}

type DirectoryNode = {
  readonly kind: 'directory'
  readonly name: string
  readonly path: string
  readonly children: readonly TreeNode[]
}

type TreeNode = FileNode | DirectoryNode
type MutableDirectory = {
  readonly directories: Map<string, MutableDirectory>
  readonly files: FileResource[]
}

const directory = (): MutableDirectory => ({ directories: new Map(), files: [] })

const buildNodes = (current: MutableDirectory, parentPath = ''): readonly TreeNode[] => {
  const directories = [...current.directories.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, child]) => {
      const path = parentPath ? `${parentPath}/${name}` : name
      return { kind: 'directory' as const, name, path, children: buildNodes(child, path) }
    })
  const fileNodes = current.files
    .toSorted((left, right) => left.path.localeCompare(right.path))
    .map(file => ({
      kind: 'file' as const,
      name: file.path.split('/').at(-1) ?? file.path,
      path: file.path,
    }))
  return [...directories, ...fileNodes]
}

const fileTree = (values: readonly FileResource[]): readonly TreeNode[] => {
  const root = directory()
  values.forEach(file => {
    const parts = file.path.split('/')
    const fileName = parts.at(-1)
    if (!fileName) return
    const parent = parts.slice(0, -1).reduce((current, part) => {
      const existing = current.directories.get(part)
      if (existing) return existing
      const next = directory()
      current.directories.set(part, next)
      return next
    }, root)
    parent.files.push(file)
  })
  return buildNodes(root)
}

const TreeItem = ({
  node,
  level,
  expanded,
  searching,
  onFolder,
  onOpen,
  projectName,
}: {
  readonly node: TreeNode
  readonly level: number
  readonly expanded: ReadonlySet<string>
  readonly searching: boolean
  readonly onFolder: (path: string) => void
  readonly onOpen: (resource: ResourceRef) => void
  readonly projectName: string
}) => {
  const paddingLeft = `${0.5 + level * 0.875}rem`
  if (node.kind === 'file')
    return (
      <button
        type="button"
        className="flex h-7.25 w-full min-w-0 items-center gap-1.5 rounded-sm border-0 bg-transparent pr-1.75 text-left text-muted hover:bg-hover hover:text-foreground [&>span]:truncate [&>span]:min-w-0 [&>svg]:w-3.25 [&>svg]:flex-none"
        style={{ paddingLeft }}
        onClick={() => onOpen({ type: 'file', projectName, path: node.path })}
        title={node.path}
      >
        <File aria-hidden="true" />
        <span>{node.name}</span>
      </button>
    )

  const open = searching || expanded.has(node.path)
  return (
    <div>
      <button
        type="button"
        className="flex h-7.25 w-full min-w-0 items-center gap-1.5 rounded-sm border-0 bg-transparent pr-1.75 text-left text-muted hover:bg-hover hover:text-foreground [&>span]:truncate [&>span]:min-w-0 [&>svg]:w-3.25 [&>svg]:flex-none"
        style={{ paddingLeft }}
        onClick={() => onFolder(node.path)}
        aria-expanded={open}
        title={node.path}
      >
        {open ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        <Folder aria-hidden="true" />
        <span>{node.name}</span>
      </button>
      {open &&
        node.children.map(child => (
          <TreeItem
            key={`${child.kind}:${child.path}`}
            node={child}
            level={level + 1}
            expanded={expanded}
            searching={searching}
            onFolder={onFolder}
            onOpen={onOpen}
            projectName={projectName}
          />
        ))}
    </div>
  )
}

export const FileTree = ({
  projectName,
  query,
  onQuery,
  onOpen,
}: {
  readonly projectName: string
  readonly query: string
  readonly onQuery: (query: string) => void
  readonly onOpen: (resource: ResourceRef) => void
}) => {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () =>
      new Set([
        'docs',
        'docs/architecture',
        'docs/design',
        'docs/product',
        'docs/research',
        'ui-packages',
        'ui-packages/web',
        'ui-packages/web/src',
      ]),
  )
  const projectFiles = files.filter(file => file.projectName === projectName)
  const normalized = query.trim().toLowerCase()
  const visible = projectFiles.filter(
    file => normalized === '' || file.path.toLowerCase().includes(normalized),
  )
  const nodes = fileTree(visible)
  const toggle = (path: string) =>
    setExpanded(current => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  return (
    <ProjectBrowserFrame
      title="Files"
      total={projectFiles.length}
      filtered={visible.length}
      query={query}
      onQuery={onQuery}
    >
      {nodes.length > 0 ? (
        <div className="pt-0.5">
          {nodes.map(node => (
            <TreeItem
              key={`${node.kind}:${node.path}`}
              node={node}
              level={0}
              expanded={expanded}
              searching={normalized !== ''}
              onFolder={toggle}
              onOpen={onOpen}
              projectName={projectName}
            />
          ))}
        </div>
      ) : (
        <div className="grid justify-items-center gap-1 px-4 py-8 text-center text-muted [&>span]:max-w-52 [&>span]:text-[0.6875rem] [&>span]:leading-normal [&>strong]:text-xs [&>strong]:text-foreground">
          <strong>{projectFiles.length > 0 ? 'No matching Files' : 'No Files to show'}</strong>
          <span>
            {projectFiles.length > 0 ? 'Try a different path.' : 'This project directory is empty.'}
          </span>
        </div>
      )}
    </ProjectBrowserFrame>
  )
}
