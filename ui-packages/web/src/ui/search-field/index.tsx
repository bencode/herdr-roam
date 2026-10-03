import { Search } from 'lucide-react'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { cn } from '../../lib/cn'

type SearchFieldProps = Omit<ComponentPropsWithRef<'input'>, 'size'> & {
  readonly label: string
  readonly size?: 'sm' | 'md'
  readonly trailing?: ReactNode
}

export const SearchField = ({
  label,
  size = 'md',
  trailing,
  className,
  ...props
}: SearchFieldProps) => (
  <label
    className={cn(
      'flex min-w-0 items-center gap-2 border border-border bg-surface px-2 transition-[border-color,box-shadow] duration-150 focus-within:border-primary focus-within:shadow-[0_0_0_1px_var(--primary)]',
      size === 'sm' ? 'h-(--control-sm) rounded-sm' : 'h-(--control-md) rounded-md',
      className,
    )}
  >
    <Search className="size-3.5 flex-none text-faint" aria-hidden="true" />
    <input
      {...props}
      aria-label={label}
      className="min-w-0 flex-1 border-0 bg-transparent p-0 text-xs text-foreground outline-none! placeholder:text-faint"
    />
    {trailing && (
      <span className="flex-none text-2xs text-muted tabular-nums" aria-live="polite">
        {trailing}
      </span>
    )}
  </label>
)
