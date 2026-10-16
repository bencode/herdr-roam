import { useEffect, useRef } from 'react'
import styles from './style.module.scss'

export type MarkdownHeading = {
  readonly id: string
  readonly level: number
  readonly label: string
}

type OutlineVariant = 'column' | 'drawer'

export const MarkdownOutline = ({
  headings,
  activeId,
  variant,
  onSelect,
  onClose,
}: {
  readonly headings: readonly MarkdownHeading[]
  readonly activeId: string | null
  readonly variant: OutlineVariant
  readonly onSelect: (id: string) => void
  readonly onClose: () => void
}) => {
  const navRef = useRef<HTMLElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)
  const minimumLevel = Math.min(...headings.map(heading => heading.level))

  useEffect(() => {
    if (variant !== 'drawer') return
    ;(activeRef.current ?? navRef.current?.querySelector('button'))?.focus({ preventScroll: true })
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [variant, onClose])

  useEffect(() => {
    if (!activeId) return
    const nav = navRef.current
    const active = activeRef.current
    if (!nav || !active) return
    const bounds = nav.getBoundingClientRect()
    const item = active.getBoundingClientRect()
    if (item.top < bounds.top) nav.scrollTop += item.top - bounds.top
    else if (item.bottom > bounds.bottom) nav.scrollTop += item.bottom - bounds.bottom
  }, [activeId])

  if (headings.length === 0) return null
  const nav = (
    <nav ref={navRef} className={styles.outline} data-variant={variant} aria-label="On this page">
      {headings.map(heading => (
        <button
          type="button"
          key={heading.id}
          ref={heading.id === activeId ? activeRef : undefined}
          style={{ paddingInlineStart: `${10 + (heading.level - minimumLevel) * 14}px` }}
          aria-current={heading.id === activeId ? 'location' : undefined}
          onClick={() => {
            if (variant === 'drawer') onClose()
            onSelect(heading.id)
          }}
          title={heading.label}
        >
          {heading.label}
        </button>
      ))}
    </nav>
  )
  return variant === 'column' ? (
    nav
  ) : (
    <div className={styles.outlineDrawer}>
      <button
        type="button"
        className={styles.outlineBackdrop}
        aria-label="Close outline"
        onClick={onClose}
      />
      {nav}
    </div>
  )
}
