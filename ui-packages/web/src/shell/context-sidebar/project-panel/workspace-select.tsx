import type { ProjectWorkspace } from '@herdr-roam/shared'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, FolderGit2, GitBranch } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../../lib/cn'
import styles from './style.module.scss'

type Props = {
  readonly items: readonly ProjectWorkspace[]
  readonly value: string
  readonly onValueChange: (workspaceId: string) => void
  readonly label?: string
  readonly layout?: 'toolbar' | 'field'
  readonly disabled?: boolean
  readonly showSingle?: boolean
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

export const WorkspaceSelect = ({
  items,
  value,
  onValueChange,
  label = 'File directory',
  layout = 'toolbar',
  disabled = false,
  showSingle = false,
}: Props) => {
  const [open, setOpen] = useState(false)
  const content = useRef<HTMLDivElement>(null)
  const active = items.find(workspace => workspace.id === value) ?? items[0]
  if (!active || (items.length < 2 && !showSingle)) return null
  const branch = branchLabel(active)
  const requiresSelection = layout === 'field' && active.id !== value
  const selectedLabel = requiresSelection ? 'Choose a directory' : (branch ?? active.name)
  if (items.length === 1 && !requiresSelection) {
    return (
      <div className={cn(styles.workspaceTrigger, layout === 'field' && styles.workspaceField)}>
        <FolderGit2 aria-hidden="true" />
        <span className={styles.workspaceTriggerLabel} title={active.path}>
          {selectedLabel}
          {active.primary && ' · Project root'}
        </span>
      </div>
    )
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(styles.workspaceTrigger, layout === 'field' && styles.workspaceField)}
          aria-label={label}
          disabled={disabled}
          title={requiresSelection ? label : `${selectedLabel} · ${active.path}`}
        >
          {active.kind === 'worktree' ? (
            <GitBranch aria-hidden="true" />
          ) : (
            <FolderGit2 aria-hidden="true" />
          )}
          <span className={styles.workspaceTriggerLabel}>
            {selectedLabel}
            {layout === 'field' && !requiresSelection && active.primary && ' · Project root'}
          </span>
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
              content.current
                ?.querySelector<HTMLButtonElement>(
                  requiresSelection ? '[role="option"]' : '[data-selected]',
                )
                ?.focus(),
            )
          }}
          aria-label={label}
        >
          <div role="listbox" aria-label={label}>
            {items.map(workspace => {
              const optionBranch = branchLabel(workspace)
              const selected = !requiresSelection && workspace.id === active.id
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
