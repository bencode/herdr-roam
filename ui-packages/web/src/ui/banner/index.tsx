import { cva } from 'class-variance-authority'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

const bannerVariants = cva('flex min-h-8 items-center gap-2 px-3 py-1.5 text-xs leading-4', {
  variants: {
    tone: {
      warning: 'border-warning/30 bg-warning/8 text-muted',
      danger: 'border-danger/30 bg-danger/8 text-danger',
    },
    inset: {
      true: 'rounded-md border',
      false: 'border-b',
    },
  },
  defaultVariants: { inset: false },
})

type BannerProps = {
  readonly tone: 'warning' | 'danger'
  readonly inset?: boolean
  readonly action?: ReactNode
  readonly className?: string
  readonly children: ReactNode
}

export const Banner = ({ tone, inset = false, action, className, children }: BannerProps) => (
  <div
    className={cn(bannerVariants({ tone, inset }), className)}
    role={tone === 'danger' ? 'alert' : 'status'}
  >
    <div className="min-w-0 flex-1">{children}</div>
    {action}
  </div>
)
