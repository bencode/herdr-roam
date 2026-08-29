import { Bot, Box, Folder, type LucideIcon, Server, Settings } from 'lucide-react'
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
  runtimeActive,
  onChange,
  onRuntime,
}: {
  readonly active: GlobalDimension
  readonly runtimeActive: boolean
  readonly onChange: (dimension: GlobalDimension) => void
  readonly onRuntime: () => void
}) => (
  <div className="flex w-11 min-h-0 flex-none flex-col border-border border-r py-1">
    <nav className="grid" aria-label="Global navigation">
      {items.map(item => {
        const Icon = item.icon
        return (
          <button
            type="button"
            key={item.dimension}
            className={cn(
              'grid size-11 place-items-center border-0 bg-transparent text-muted hover:bg-hover hover:text-foreground [&_svg]:size-4',
              item.dimension === active && 'bg-primary-soft text-primary',
            )}
            onClick={() => onChange(item.dimension)}
            aria-current={item.dimension === active ? 'page' : undefined}
            aria-label={item.label}
            title={item.label}
          >
            <Icon aria-hidden="true" />
          </button>
        )
      })}
    </nav>
    <div className="mt-auto grid">
      <button
        type="button"
        className="relative grid size-11 place-items-center border-0 bg-transparent text-muted hover:bg-hover hover:text-foreground [&_svg]:size-4"
        onClick={onRuntime}
        title="Herdr connected — Open Runtime settings"
        aria-label="Herdr connected — Open Runtime settings"
      >
        <Server aria-hidden="true" />
        <i
          className="absolute right-3 bottom-[0.6875rem] size-1.5 rounded-full border border-sidebar bg-success"
          aria-hidden="true"
        />
      </button>
      <ThemeSelect />
      <button
        type="button"
        className={cn(
          'grid size-11 place-items-center border-0 bg-transparent text-muted hover:bg-hover hover:text-foreground [&_svg]:size-4',
          runtimeActive && 'bg-primary-soft text-primary',
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
