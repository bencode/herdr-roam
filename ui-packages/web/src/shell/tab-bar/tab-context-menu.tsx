import type { KeyboardEvent, ReactNode } from 'react'
import { type ResourceRef, resourceKey } from '../../workbench/resource'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '../../ui/context-menu'

type Props = {
  readonly children: ReactNode
  readonly resource: ResourceRef
  readonly tabs: readonly ResourceRef[]
  readonly onCloseMany: (resources: readonly ResourceRef[]) => void
}

const openFromKeyboard = (event: KeyboardEvent<HTMLElement>): void => {
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

export const TabContextMenu = ({ children, resource, tabs, onCloseMany }: Props) => {
  const key = resourceKey(resource)
  const index = tabs.findIndex(tab => resourceKey(tab) === key)
  const otherTabs = tabs.filter(tab => resourceKey(tab) !== key)
  const rightTabs = index < 0 ? [] : tabs.slice(index + 1)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onKeyDown={openFromKeyboard}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent aria-label="Tab actions">
        <ContextMenuItem onSelect={() => onCloseMany([resource])}>Close</ContextMenuItem>
        <ContextMenuItem disabled={otherTabs.length === 0} onSelect={() => onCloseMany(otherTabs)}>
          Close Other Tabs
        </ContextMenuItem>
        <ContextMenuItem disabled={rightTabs.length === 0} onSelect={() => onCloseMany(rightTabs)}>
          Close Tabs to the Right
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onCloseMany(tabs)}>Close All Tabs</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
