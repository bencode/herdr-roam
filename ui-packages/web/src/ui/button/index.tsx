import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentPropsWithRef } from 'react'
import { cn } from '../../lib/cn'

const buttonVariants = cva(
  'inline-flex flex-none items-center justify-center gap-1.5 whitespace-nowrap border-0 text-xs leading-5 transition-[color,background-color,border-color,filter] duration-150 [&_svg]:flex-none',
  {
    variants: {
      variant: {
        ghost:
          'bg-transparent text-muted hover:enabled:bg-hover hover:enabled:text-foreground data-[state=open]:bg-hover data-[state=open]:text-foreground',
        secondary:
          'border border-border bg-transparent text-foreground hover:enabled:border-border-strong hover:enabled:bg-hover',
        primary:
          'bg-primary font-medium text-on-accent hover:enabled:brightness-95 active:enabled:brightness-90',
        danger:
          'bg-danger font-medium text-on-accent hover:enabled:brightness-95 active:enabled:brightness-90',
        dangerGhost:
          'bg-transparent text-muted hover:enabled:bg-danger/10 hover:enabled:text-danger',
      },
      size: {
        compact: 'h-(--control-sm) rounded-sm px-2.5 [&_svg]:size-3',
        default: 'h-(--control-md) rounded-md px-2.5 [&_svg]:size-3.5',
        compactIcon: 'size-(--control-sm) rounded-sm p-0 [&_svg]:size-3',
        defaultIcon: 'size-(--control-md) rounded-md p-0 [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'ghost', size: 'default' },
  },
)

type ButtonProps = ComponentPropsWithRef<'button'> & VariantProps<typeof buttonVariants>

export const Button = ({ className, variant, size, type = 'button', ...props }: ButtonProps) => (
  <button {...props} type={type} className={cn(buttonVariants({ variant, size }), className)} />
)
