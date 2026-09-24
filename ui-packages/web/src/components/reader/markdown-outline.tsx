import { useEffect } from 'react'
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
  useEffect(() => {
    if (variant !== 'drawer') return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [variant, onClose])

  if (headings.length === 0) return null

  const nav = (
    <nav className={styles.outline} data-variant={variant} aria-label="On this page">
      <strong>On this page</strong>
      {headings.map(heading => (
        <button
          type="button"
          key={heading.id}
          style={{ paddingLeft: `${0.625 + (heading.level - 1) * 0.75}rem` }}
          aria-current={heading.id === activeId ? 'location' : undefined}
          onClick={() => {
            onSelect(heading.id)
            if (variant === 'drawer') onClose()
          }}
          title={heading.label}
        >
          {heading.label}
        </button>
      ))}
    </nav>
  )

  if (variant === 'column') return nav
  return (
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
