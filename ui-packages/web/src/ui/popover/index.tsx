import * as RadixPopover from '@radix-ui/react-popover'
import type { ComponentPropsWithRef } from 'react'
import { cn } from '../../lib/cn'

export const popoverSurfaceClass =
  'z-(--z-dropdown) rounded-md border border-border bg-surface text-foreground shadow-(--shadow-popover) outline-none'

export const PopoverContent = ({
  className,
  sideOffset = 4,
  collisionPadding = 8,
  ...props
}: ComponentPropsWithRef<typeof RadixPopover.Content>) => (
  <RadixPopover.Portal>
    <RadixPopover.Content
      {...props}
      sideOffset={sideOffset}
      collisionPadding={collisionPadding}
      className={cn(popoverSurfaceClass, className)}
    />
  </RadixPopover.Portal>
)
