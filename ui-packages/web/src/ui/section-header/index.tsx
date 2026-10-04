import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type SectionHeaderProps = {
  readonly title: string
  readonly id?: string
  readonly count?: number
  readonly action?: ReactNode
  readonly className?: string
}

export const SectionHeader = ({ title, id, count, action, className }: SectionHeaderProps) => (
  <h2
    id={id}
    className={cn(
      'm-0 flex h-7 items-center gap-2 px-2 text-2xs font-semibold uppercase tracking-[0.08em] text-faint',
      className,
    )}
  >
    <span>{title}</span>
    {count !== undefined && <span className="font-normal tabular-nums">{count}</span>}
    {action && <span className="ml-auto normal-case tracking-normal">{action}</span>}
  </h2>
)
