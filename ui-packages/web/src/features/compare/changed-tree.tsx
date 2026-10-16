import type { CompareFile } from '@herdr-roam/shared'
import { ChevronDown, FileCode2, Folder } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { filePath } from './file-path'
import styles from './style.module.scss'

type Node =
  | {
      readonly kind: 'directory'
      readonly path: string
      readonly name: string
      readonly children: Node[]
    }
  | {
      readonly kind: 'file'
      readonly path: string
      readonly name: string
      readonly entry: CompareFile
    }

export const changedTree = (
  files: readonly CompareFile[],
  query: string,
): { readonly nodes: readonly Node[]; readonly paths: readonly string[] } => {
  const root: Extract<Node, { kind: 'directory' }> = {
    kind: 'directory',
    path: '',
    name: '',
    children: [],
  }
  files
    .filter(entry =>
      `${entry.oldPath ?? ''}\n${entry.newPath ?? ''}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    )
    .forEach(entry => {
      const parts = filePath(entry).split('/')
      const parent = parts
        .slice(0, -1)
        .reduce<Extract<Node, { kind: 'directory' }>>((parent, name, index) => {
          const path = parts.slice(0, index + 1).join('/')
          const existing = parent.children.find(
            child => child.kind === 'directory' && child.path === path,
          )
          if (existing?.kind === 'directory') return existing
          const node: Extract<Node, { kind: 'directory' }> = {
            kind: 'directory',
            path,
            name,
            children: [],
          }
          parent.children.push(node)
          return node
        }, root)
      parent.children.push({ kind: 'file', path: filePath(entry), name: parts.at(-1) ?? '', entry })
    })
  const sort = (nodes: readonly Node[]): Node[] =>
    nodes
      .toSorted(
        (a, b) =>
          Number(a.kind === 'file') - Number(b.kind === 'file') || a.name.localeCompare(b.name),
      )
      .map(node => (node.kind === 'directory' ? { ...node, children: sort(node.children) } : node))
  const nodes = sort(root.children)
  const pathsOf = (items: readonly Node[]): string[] =>
    items.flatMap(node => (node.kind === 'file' ? [filePath(node.entry)] : pathsOf(node.children)))
  return { nodes, paths: pathsOf(nodes) }
}

const statusLabel = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
  'type-changed': 'T',
} as const

const TreeNode = ({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  readonly node: Node
  readonly depth: number
  readonly selectedPath: string
  readonly onSelect: (path: string) => void
}) => {
  if (node.kind === 'file')
    return (
      <button
        type="button"
        className={styles.treeFile}
        style={{ paddingLeft: 12 + depth * 14 }}
        aria-current={selectedPath === node.path ? 'true' : undefined}
        onClick={() => onSelect(node.path)}
        title={
          node.entry.status === 'renamed'
            ? `${node.entry.oldPath} → ${node.entry.newPath}`
            : `${node.path} · ${node.entry.status}`
        }
      >
        <FileCode2 aria-hidden="true" />
        <span>{node.name}</span>
        <small data-status={node.entry.status}>{statusLabel[node.entry.status]}</small>
      </button>
    )
  let folder = node
  const labels = [node.name]
  while (folder.children.length === 1 && folder.children[0]?.kind === 'directory') {
    const child = folder.children[0]
    if (child?.kind !== 'directory') break
    folder = child
    labels.push(child.name)
  }
  return (
    <details open className={styles.treeFolder}>
      <summary style={{ paddingLeft: 8 + depth * 14 }}>
        <ChevronDown aria-hidden="true" />
        <Folder aria-hidden="true" />
        <span title={folder.path}>{labels.join('/')}</span>
      </summary>
      {folder.children.map(child => (
        <TreeNode
          key={`${child.kind}:${child.path}`}
          node={child}
          depth={depth + 1}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </details>
  )
}

export const ChangedFileTree = ({
  nodes,
  query,
  selectedPath,
  onSelect,
}: {
  readonly nodes: readonly Node[]
  readonly query: string
  readonly selectedPath: string
  readonly onSelect: (path: string) => void
}) => {
  const root = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!query.trim() || nodes.length === 0) return
    root.current?.querySelectorAll('details').forEach(folder => {
      folder.open = true
    })
  }, [query, nodes])
  useEffect(() => {
    if (!selectedPath) return
    const selected = root.current?.querySelector<HTMLElement>('[aria-current]')
    let ancestor = selected?.parentElement
    while (ancestor && ancestor !== root.current) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true
      ancestor = ancestor.parentElement
    }
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedPath])
  return (
    <nav className={styles.tree} aria-label="Changed files" ref={root}>
      {nodes.map(node => (
        <TreeNode
          key={`${node.kind}:${node.path}`}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
      {nodes.length === 0 && <p className={styles.noResults}>No matching files.</p>}
    </nav>
  )
}
