import { Combobox } from '@base-ui/react/combobox'
import type { CompareBranch, CompareBranches } from '@herdr-roam/shared'
import { Check, ChevronDown, GitBranch, Search } from 'lucide-react'
import { useMemo } from 'react'
import { cn } from '../../lib/cn'
import { popoverSurfaceClass } from '../../ui/popover'

type BranchGroup = {
  readonly value: string
  readonly items: CompareBranch[]
}

type Props = {
  readonly label: string
  readonly value: string
  readonly catalog: CompareBranches | null
  readonly onChange: (ref: string) => void
}

export const BranchSelect = ({ label, value, catalog, onChange }: Props) => {
  const groups = useMemo<BranchGroup[]>(
    () =>
      [
        {
          value: 'Local branches',
          items: catalog?.items.filter(branch => branch.ref.startsWith('refs/heads/')) ?? [],
        },
        {
          value: 'Remote branches',
          items: catalog?.items.filter(branch => branch.ref.startsWith('refs/remotes/')) ?? [],
        },
      ].filter(group => group.items.length > 0),
    [catalog],
  )
  const selected = catalog?.items.find(branch => branch.ref === value) ?? null
  const text =
    selected?.name ??
    (value ? `${value.replace(/^refs\/(heads|remotes)\//, '')} (unavailable)` : label)

  return (
    <Combobox.Root<CompareBranch>
      items={groups}
      value={selected}
      onValueChange={branch => {
        if (branch) onChange(branch.ref)
      }}
      itemToStringLabel={branch => branch.name}
      itemToStringValue={branch => branch.ref}
      isItemEqualToValue={(branch, current) => branch.ref === current.ref}
      disabled={!catalog}
      autoHighlight
    >
      <Combobox.Trigger
        aria-label={label}
        title={value || label}
        className="flex h-(--control-sm) min-w-0 max-w-65 flex-1 items-center gap-1.5 rounded-sm border border-border bg-surface px-2 text-left text-2xs text-foreground hover:enabled:border-border-strong aria-expanded:border-border-strong [&>svg]:size-3 [&>svg]:flex-none [&>svg]:text-muted"
      >
        <GitBranch aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-mono">{text}</span>
        <Combobox.Icon className="flex-none text-faint [&>svg]:block [&>svg]:size-3">
          <ChevronDown aria-hidden="true" />
        </Combobox.Icon>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="z-(--z-dropdown)"
        >
          <Combobox.Popup
            aria-label={`${label} options`}
            className={cn(
              popoverSurfaceClass,
              'flex max-h-[min(24rem,var(--available-height))] w-80 max-w-[calc(100vw-1rem)] flex-col overflow-hidden',
            )}
            onKeyDown={event => event.stopPropagation()}
          >
            <div className="border-border border-b p-1.5">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-faint"
                />
                <Combobox.Input
                  aria-label={`Search ${label.toLowerCase()}`}
                  placeholder="Find a branch…"
                  className="h-(--control-sm) w-full rounded-sm border border-border bg-surface pr-2 pl-7 text-xs text-foreground placeholder:text-faint"
                />
              </div>
            </div>
            <Combobox.Empty>
              <p className="m-0 px-3 py-4 text-xs text-muted">No matching branches.</p>
            </Combobox.Empty>
            <Combobox.List className="min-h-0 overflow-y-auto overscroll-contain p-1">
              {(group: BranchGroup) => (
                <Combobox.Group key={group.value} items={group.items}>
                  <Combobox.GroupLabel className="px-2 pt-2 pb-1 text-2xs font-medium text-faint">
                    {group.value}
                  </Combobox.GroupLabel>
                  <Combobox.Collection>
                    {(branch: CompareBranch) => (
                      <Combobox.Item
                        key={branch.ref}
                        value={branch}
                        title={branch.ref}
                        className="flex h-(--control-sm) min-w-0 cursor-default items-center gap-2 rounded-sm px-2 text-2xs text-foreground outline-none data-highlighted:bg-hover data-selected:bg-raised"
                      >
                        <span className="min-w-0 flex-1 truncate font-mono">{branch.name}</span>
                        <Combobox.ItemIndicator className="flex-none text-primary [&>svg]:size-3.5">
                          <Check aria-hidden="true" />
                        </Combobox.ItemIndicator>
                      </Combobox.Item>
                    )}
                  </Combobox.Collection>
                </Combobox.Group>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
