import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type EmptyStateProps = {
  readonly icon?: ReactNode
  readonly title?: string
  readonly children: ReactNode
  readonly className?: string
}

export const EmptyState = ({ icon, title, children, className }: EmptyStateProps) => (
  <div className={cn('grid justify-items-center gap-1 px-4 py-8 text-center', className)}>
    {icon && <span className="mb-2 text-faint [&>svg]:size-5">{icon}</span>}
    {title && <p className="m-0 text-sm font-medium text-foreground">{title}</p>}
    <p className="m-0 text-xs text-muted">{children}</p>
  </div>
)
