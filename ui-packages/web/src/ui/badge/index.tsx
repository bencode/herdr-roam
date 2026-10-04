import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export const Badge = ({
  className,
  children,
}: {
  readonly className?: string
  readonly children: ReactNode
}) => (
  <span
    className={cn(
      'flex-none rounded-full border border-border px-1.5 text-2xs leading-4 text-muted',
      className,
    )}
  >
    {children}
  </span>
)
