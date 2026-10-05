import * as RadixContextMenu from '@radix-ui/react-context-menu'
import type { ComponentPropsWithRef, KeyboardEvent } from 'react'
import { cn } from '../../lib/cn'
import { menuItemVariants } from '../menu'
import { popoverSurfaceClass } from '../popover'

export const ContextMenu = RadixContextMenu.Root
export const ContextMenuTrigger = RadixContextMenu.Trigger

export const ContextMenuContent = ({
  className,
  collisionPadding = 8,
  ...props
}: ComponentPropsWithRef<typeof RadixContextMenu.Content>) => (
  <RadixContextMenu.Portal>
    <RadixContextMenu.Content
      {...props}
      collisionPadding={collisionPadding}
      className={cn(popoverSurfaceClass, 'min-w-46 p-1', className)}
    />
  </RadixContextMenu.Portal>
)

export const ContextMenuItem = ({
  className,
  ...props
}: ComponentPropsWithRef<typeof RadixContextMenu.Item>) => (
  <RadixContextMenu.Item {...props} className={cn(menuItemVariants(), className)} />
)

export const ContextMenuSeparator = ({
  className,
  ...props
}: ComponentPropsWithRef<typeof RadixContextMenu.Separator>) => (
  <RadixContextMenu.Separator {...props} className={cn('my-1 h-px bg-border', className)} />
)

/** Opens a context menu from the keyboard (ContextMenu key or Shift+F10) at the element's edge. */
export const openContextMenuFromKeyboard = (event: KeyboardEvent<HTMLElement>): void => {
  const requested = event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')
  if (!requested) return
  event.preventDefault()
  const bounds = event.currentTarget.getBoundingClientRect()
  event.currentTarget.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: bounds.left + Math.min(bounds.width / 2, 24),
      clientY: bounds.bottom,
    }),
  )
}
