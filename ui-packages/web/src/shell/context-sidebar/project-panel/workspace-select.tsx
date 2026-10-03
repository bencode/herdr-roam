import type { ProjectWorkspace } from '@herdr-roam/shared'
import * as Popover from '@radix-ui/react-popover'
import { Check, ChevronDown, FolderGit2, GitBranch } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../../../lib/cn'
import { PopoverContent } from '../../../ui/popover'

type Props = {
  readonly items: readonly ProjectWorkspace[]
  readonly value: string
  readonly onValueChange: (workspaceId: string) => void
  readonly label?: string
  readonly layout?: 'inline' | 'field'
  readonly disabled?: boolean
  readonly showSingle?: boolean
}

const branchLabel = (workspace: ProjectWorkspace): string | null => {
  if (workspace.kind !== 'worktree') return null
  return workspace.branch ?? 'Detached'
}

const triggerClass = {
  inline:
    'flex h-6 min-w-0 max-w-32 items-center gap-1 rounded-sm border-0 bg-transparent px-1.5 text-left text-2xs text-muted hover:enabled:bg-hover hover:enabled:text-foreground data-[state=open]:bg-hover data-[state=open]:text-foreground [&>svg]:size-3',
  field:
    'flex h-(--control-md) w-full min-w-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2 text-left text-xs text-foreground outline-none! transition-[border-color,box-shadow] duration-150 hover:enabled:border-border-strong focus-visible:border-primary focus-visible:shadow-[0_0_0_1px_var(--primary)] data-[state=open]:border-primary disabled:cursor-not-allowed disabled:opacity-45',
} as const

const triggerIconClass = '[&>svg]:size-3.5 [&>svg]:flex-none [&>svg]:text-faint'

const TriggerLabel = ({ text, root }: { readonly text: string; readonly root: boolean }) => (
  <span className="min-w-0 truncate font-mono">
    {text}
    {root && <span className="font-sans text-muted"> · Project root</span>}
  </span>
)

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
  layout = 'inline',
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
      <div className={cn(triggerIconClass, triggerClass[layout])} title={active.path}>
        <FolderGit2 aria-hidden="true" />
        <TriggerLabel text={selectedLabel} root={active.primary} />
      </div>
    )
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(triggerIconClass, triggerClass[layout])}
          aria-label={label}
          disabled={disabled}
          title={requiresSelection ? label : `${selectedLabel} · ${active.path}`}
        >
          {active.kind === 'worktree' ? (
            <GitBranch aria-hidden="true" />
          ) : (
            <FolderGit2 aria-hidden="true" />
          )}
          <TriggerLabel
            text={selectedLabel}
            root={layout === 'field' && !requiresSelection && active.primary}
          />
          <ChevronDown className="ml-auto" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <PopoverContent
        ref={content}
        className="max-h-[min(24rem,var(--radix-popover-content-available-height))] w-max min-w-(--radix-popover-trigger-width) max-w-[min(28rem,calc(100vw-1rem))] overflow-auto p-1"
        align={layout === 'inline' ? 'end' : 'start'}
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
                className="flex w-full min-w-0 items-start gap-2 rounded-sm border-0 bg-transparent px-2 py-1.75 text-left text-foreground outline-none hover:bg-hover focus-visible:bg-hover data-selected:bg-hover"
                key={workspace.id}
                onClick={() => {
                  onValueChange(workspace.id)
                  setOpen(false)
                }}
              >
                <span className="grid h-4 flex-none place-items-center text-muted [&>svg]:size-3.5">
                  {workspace.kind === 'worktree' ? (
                    <GitBranch aria-hidden="true" />
                  ) : (
                    <FolderGit2 aria-hidden="true" />
                  )}
                </span>
                <span className="grid min-w-0 flex-1 gap-0.75">
                  <span className="flex min-w-0 items-baseline gap-1.5 text-xs">
                    <strong className="min-w-0 truncate font-medium">{workspace.name}</strong>
                    {optionBranch && (
                      <small className="min-w-0 truncate font-mono text-2xs text-muted">
                        {optionBranch}
                      </small>
                    )}
                    {workspace.primary && (
                      <small className="flex-none text-2xs text-muted">Project</small>
                    )}
                  </span>
                  <code className="truncate font-mono text-2xs text-faint" title={workspace.path}>
                    {workspace.path}
                  </code>
                </span>
                {selected && (
                  <Check className="h-4 w-3.5 flex-none text-primary" aria-hidden="true" />
                )}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover.Root>
  )
}
