import { useId } from 'react'
import { cn } from '../../lib/cn'

type Option<Value extends string> = { readonly value: Value; readonly label: string }

type SegmentedControlProps<Value extends string> = {
  readonly label: string
  readonly options: readonly Option<Value>[]
  readonly value: Value
  readonly onValueChange: (value: Value) => void
  readonly size?: 'sm' | 'md'
  readonly disabled?: boolean
  readonly className?: string
}

export const SegmentedControl = <Value extends string>({
  label,
  options,
  value,
  onValueChange,
  size = 'md',
  disabled = false,
  className,
}: SegmentedControlProps<Value>) => {
  const name = useId()
  return (
    <fieldset
      disabled={disabled}
      className={cn(
        'm-0 inline-flex min-w-0 items-stretch gap-0.5 rounded-md border border-border bg-raised p-0.5',
        size === 'sm' ? 'h-(--control-sm)' : 'h-(--control-md)',
        className,
      )}
    >
      <legend className="sr-only">{label}</legend>
      {options.map(option => {
        const checked = option.value === value
        return (
          <label
            key={option.value}
            className={cn(
              'relative flex cursor-pointer items-center rounded-sm px-2.5 text-xs text-muted transition-colors duration-150 hover:text-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary has-[:focus-visible]:-outline-offset-2',
              checked && 'bg-surface font-medium text-foreground shadow-xs',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={checked}
              onChange={() => onValueChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        )
      })}
    </fieldset>
  )
}
