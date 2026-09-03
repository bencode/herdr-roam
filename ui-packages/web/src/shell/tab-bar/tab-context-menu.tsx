import * as ContextMenu from '@radix-ui/react-context-menu'
import type { KeyboardEvent, ReactNode } from 'react'
import { type ResourceRef, resourceKey } from '../../workbench/resource'
import styles from './style.module.scss'

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
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild onKeyDown={openFromKeyboard}>
        {children}
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className={styles.menu} collisionPadding={8} aria-label="Tab actions">
          <ContextMenu.Item className={styles.menuItem} onSelect={() => onCloseMany([resource])}>
            Close
          </ContextMenu.Item>
          <ContextMenu.Item
            className={styles.menuItem}
            disabled={otherTabs.length === 0}
            onSelect={() => onCloseMany(otherTabs)}
          >
            Close Other Tabs
          </ContextMenu.Item>
          <ContextMenu.Item
            className={styles.menuItem}
            disabled={rightTabs.length === 0}
            onSelect={() => onCloseMany(rightTabs)}
          >
            Close Tabs to the Right
          </ContextMenu.Item>
          <ContextMenu.Separator className={styles.menuSeparator} />
          <ContextMenu.Item className={styles.menuItem} onSelect={() => onCloseMany(tabs)}>
            Close All Tabs
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}
