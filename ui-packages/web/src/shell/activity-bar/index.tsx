import { Bot, Box, Folder, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
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
  onChange,
}: {
  readonly active: GlobalDimension
  readonly paths: Readonly<Record<GlobalDimension, string>>
  readonly onChange: (dimension: GlobalDimension) => void
}) => {
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
        <ThemeSelect />
      </div>
    </div>
  )
}
