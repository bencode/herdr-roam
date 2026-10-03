import { cva } from 'class-variance-authority'
import { Check } from 'lucide-react'
import type { ComponentPropsWithRef } from 'react'
import { cn } from '../../lib/cn'

export const menuItemVariants = cva(
  'flex h-(--control-sm) w-full cursor-default select-none items-center gap-2 rounded-sm border-0 bg-transparent px-2 text-left text-xs text-foreground outline-none hover:bg-hover focus-visible:bg-hover data-[highlighted]:bg-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-45 disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-3.5 [&_svg]:flex-none',
  {
    variants: {
      tone: {
        default: '',
        muted: 'text-muted hover:text-foreground',
      },
    },
    defaultVariants: { tone: 'default' },
  },
)

type MenuItemProps = ComponentPropsWithRef<'button'> & {
  readonly selected?: boolean
  readonly tone?: 'default' | 'muted'
}

export const MenuItem = ({
  selected = false,
  tone,
  className,
  children,
  type = 'button',
  ...props
}: MenuItemProps) => (
  <button {...props} type={type} className={cn(menuItemVariants({ tone }), className)}>
    {children}
    {selected && <Check className="ml-auto text-primary" aria-hidden="true" />}
  </button>
)
