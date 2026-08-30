import { Bot, Box, Folder, type LucideIcon, Server, Settings } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAgentRuntime } from '../../features/agent/runtime-provider'
import { cn } from '../../lib/cn'
import type { GlobalDimension } from '../../workbench/resource'
import { ThemeSelect } from './theme-select'

type ActivityItem = {
  readonly dimension: GlobalDimension
  readonly label: string
  readonly icon: LucideIcon
}

const items: readonly ActivityItem[] = [
  { dimension: 'projects', label: 'Projects', icon: Folder },
  { dimension: 'agents', label: 'Agents', icon: Bot },
  { dimension: 'skills', label: 'Skills', icon: Box },
]

export const ActivityBar = ({
  active,
  paths,
  runtimeActive,
  onChange,
  onRuntime,
}: {
  readonly active: GlobalDimension
  readonly paths: Readonly<Record<GlobalDimension, string>>
  readonly runtimeActive: boolean
  readonly onChange: (dimension: GlobalDimension) => void
  readonly onRuntime: () => void
}) => {
  const { snapshot, transportError } = useAgentRuntime()
  const state = transportError ? 'reconnecting' : snapshot.source.state
  const label =
    state === 'connected'
      ? 'Herdr connected'
      : state === 'reconnecting'
        ? 'Herdr reconnecting'
        : 'Herdr unavailable'
  const statusClass =
    state === 'connected' && !snapshot.stale
      ? 'bg-success'
      : state === 'reconnecting' || snapshot.stale
        ? 'bg-warning'
        : 'bg-danger'

  return (
    <div className="flex w-11 min-h-0 flex-none flex-col border-border border-r py-1">
      <nav className="grid" aria-label="Global navigation">
        {items.map(item => {
          const Icon = item.icon
          return (
            <Link
              key={item.dimension}
              className={cn(
                'm-1 grid size-9 place-items-center rounded-md text-muted no-underline focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&_svg]:size-4',
                item.dimension === active
                  ? 'bg-primary-soft text-primary'
                  : 'hover:bg-hover hover:text-foreground',
              )}
              to={paths[item.dimension]}
              onClick={() => onChange(item.dimension)}
              aria-current={item.dimension === active ? 'page' : undefined}
              aria-label={item.label}
              title={item.label}
            >
              <Icon aria-hidden="true" />
            </Link>
          )
        })}
      </nav>
      <div className="mt-auto grid">
        <button
          type="button"
          className="relative grid size-11 place-items-center border-0 bg-transparent text-muted hover:bg-hover hover:text-foreground [&_svg]:size-4"
          onClick={onRuntime}
          title={`${label} — Open Runtime settings`}
          aria-label={`${label} — Open Runtime settings`}
        >
          <Server aria-hidden="true" />
          <i
            className={cn(
              'absolute right-3 bottom-[0.6875rem] size-1.5 rounded-full border border-sidebar',
              statusClass,
            )}
            aria-hidden="true"
          />
        </button>
        <ThemeSelect />
        <button
          type="button"
          className={cn(
            'm-1 grid size-9 place-items-center rounded-md border-0 bg-transparent text-muted [&_svg]:size-4',
            runtimeActive ? 'bg-primary-soft text-primary' : 'hover:bg-hover hover:text-foreground',
          )}
          onClick={onRuntime}
          title="Runtime Settings"
          aria-label="Runtime Settings"
        >
          <Settings aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
