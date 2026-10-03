import type { ComponentPropsWithRef } from 'react'
import { cn } from '../../lib/cn'

type InputProps = Omit<ComponentPropsWithRef<'input'>, 'size'> & {
  readonly size?: 'sm' | 'md'
}

export const Input = ({ size = 'md', className, ...props }: InputProps) => (
  <input
    {...props}
    className={cn(
      'w-full min-w-0 border border-border bg-surface px-2 text-xs text-foreground outline-none! transition-[border-color,box-shadow] duration-150 placeholder:text-faint focus:border-primary focus:shadow-[0_0_0_1px_var(--primary)] disabled:opacity-45',
      size === 'sm' ? 'h-(--control-sm) rounded-sm' : 'h-(--control-md) rounded-md',
      className,
    )}
  />
)
