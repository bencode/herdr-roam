import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

type EmptyStateProps = {
  readonly icon?: ReactNode
  readonly title?: string
  readonly action?: ReactNode
  readonly role?: 'status'
  readonly children: ReactNode
  readonly className?: string
}

export const EmptyState = ({ icon, title, action, role, children, className }: EmptyStateProps) => (
  <div
    className={cn('grid justify-items-center gap-1 px-4 py-8 text-center', className)}
    role={role}
  >
    {icon && <span className="mb-2 text-faint [&>svg]:size-5">{icon}</span>}
    {title && <h2 className="m-0 text-sm font-medium text-foreground">{title}</h2>}
    <p className="m-0 text-xs text-muted">{children}</p>
    {action && <div className="mt-2">{action}</div>}
  </div>
)
