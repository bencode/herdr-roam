import type { ProjectWorkspace } from '@herdr-roam/shared'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, FolderGit2, GitBranch } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import styles from './style.module.scss'

type Props = {
  readonly items: readonly ProjectWorkspace[]
  readonly value: string
  readonly onValueChange: (workspaceId: string) => void
}

const branchLabel = (workspace: ProjectWorkspace): string | null => {
  if (workspace.kind !== 'worktree') return null
  return workspace.branch ?? 'Detached'
}

const moveOptionFocus = (event: KeyboardEvent<HTMLDivElement>): void => {
  const keys = ['ArrowDown', 'ArrowUp', 'Home', 'End']
  if (!keys.includes(event.key)) return
  const options = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'),
  )
  if (options.length === 0) return
  event.preventDefault()
  const activeElement = document.activeElement
  const current = activeElement instanceof HTMLButtonElement ? options.indexOf(activeElement) : -1
  const requested =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? options.length - 1
        : event.key === 'ArrowDown'
          ? (current + 1 + options.length) % options.length
          : (current - 1 + options.length) % options.length
  options[requested]?.focus()
}

export const WorkspaceSelect = ({ items, value, onValueChange }: Props) => {
  const [open, setOpen] = useState(false)
  const content = useRef<HTMLDivElement>(null)
  const active = items.find(workspace => workspace.id === value) ?? items[0]
  if (!active || items.length < 2) return null
  const branch = branchLabel(active)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className={styles.workspaceTrigger} aria-label="File directory">
          <FolderGit2 aria-hidden="true" />
          <span className={styles.workspaceTriggerName}>{active.name}</span>
          {branch && <span className={styles.workspaceTriggerBranch}>{branch}</span>}
          <ChevronDown aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          ref={content}
          className={styles.workspaceMenu}
          align="start"
          sideOffset={4}
          onKeyDown={moveOptionFocus}
          onOpenAutoFocus={event => {
            event.preventDefault()
            queueMicrotask(() =>
              content.current?.querySelector<HTMLButtonElement>('[data-selected]')?.focus(),
            )
          }}
          aria-label="File directories"
        >
          <div role="listbox" aria-label="File directories">
            {items.map(workspace => {
              const optionBranch = branchLabel(workspace)
              const selected = workspace.id === active.id
              return (
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  data-selected={selected || undefined}
                  className={styles.workspaceOption}
                  key={workspace.id}
                  onClick={() => {
                    onValueChange(workspace.id)
                    setOpen(false)
                  }}
                >
                  <span className={styles.workspaceOptionIcon}>
                    {workspace.kind === 'worktree' ? (
                      <GitBranch aria-hidden="true" />
                    ) : (
                      <FolderGit2 aria-hidden="true" />
                    )}
                  </span>
                  <span className={styles.workspaceOptionIdentity}>
                    <span>
                      <strong>{workspace.name}</strong>
                      {optionBranch && <small>{optionBranch}</small>}
                      {workspace.primary && <small>Project</small>}
                    </span>
                    <code title={workspace.path}>{workspace.path}</code>
                  </span>
                  {selected && <Check className={styles.workspaceCheck} aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
