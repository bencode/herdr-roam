import { Check } from 'lucide-react'
import type { ComponentPropsWithRef } from 'react'
import { cn } from '../../lib/cn'

type ToggleChipProps = Omit<ComponentPropsWithRef<'button'>, 'aria-pressed'> & {
  readonly pressed: boolean
}

export const ToggleChip = ({ pressed, className, children, ...props }: ToggleChipProps) => (
  <button
    type="button"
    {...props}
    aria-pressed={pressed}
    className={cn(
      'inline-flex h-(--control-sm) flex-none items-center gap-1.5 rounded-sm border-0 bg-transparent px-2 text-xs text-muted transition-colors duration-150 hover:enabled:bg-hover hover:enabled:text-foreground',
      pressed && 'bg-primary-soft font-medium text-foreground hover:enabled:bg-primary-soft',
      className,
    )}
  >
    {pressed && <Check className="-ml-0.5 size-3 text-primary" aria-hidden="true" />}
    {children}
  </button>
)
