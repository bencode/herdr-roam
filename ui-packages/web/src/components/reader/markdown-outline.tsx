import styles from './style.module.scss'

export type MarkdownHeading = {
  readonly id: string
  readonly level: number
  readonly label: string
}

export const MarkdownOutline = ({
  headings,
  onSelect,
}: {
  readonly headings: readonly MarkdownHeading[]
  readonly onSelect: (id: string) => void
}) => {
  if (headings.length === 0) return null
  return (
    <nav className={styles.outline} aria-label="On this page">
      <strong>On this page</strong>
      {headings.map(heading => (
        <button
          type="button"
          key={heading.id}
          style={{ paddingLeft: `${0.625 + (heading.level - 1) * 0.625}rem` }}
          onClick={() => onSelect(heading.id)}
          title={heading.label}
        >
          {heading.label}
        </button>
      ))}
    </nav>
  )
}
