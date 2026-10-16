import type { ReactElement, ReactNode } from 'react'
import { useMemo } from 'react'
import { Banner } from '../../ui/banner'
import type { MarkdownFrontmatter, MarkdownProperty, MarkdownValue } from './frontmatter'
import styles from './markdown-properties.module.scss'

const zonedTime = (value: unknown): Date | null => {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  )
    return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

const scalarContent = (value: string | number | boolean | null): ReactNode => {
  if (typeof value !== 'string') return String(value)
  const date = zonedTime(value)
  if (!date) return value === '' ? '""' : value
  return (
    <time dateTime={value} title={value}>
      {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'long' }).format(date)}
    </time>
  )
}

const PropertyValue = ({ value }: { readonly value: MarkdownValue }): ReactNode => {
  const itemKeys = useMemo(
    () =>
      value.kind === 'sequence'
        ? new Map(value.items.map(item => [item, crypto.randomUUID()]))
        : null,
    [value],
  )
  if (value.kind === 'scalar') return scalarContent(value.value)
  if (value.kind === 'alias') return <code title="YAML reference">{value.raw}</code>
  if (value.kind === 'mapping') return <PropertyFields properties={value.properties} nested />
  if (value.items.every(item => item.kind === 'scalar')) {
    return (
      <ul className={styles.values}>
        {value.items.map(item => (
          <li key={itemKeys?.get(item)}>
            <PropertyValue value={item} />
          </li>
        ))}
      </ul>
    )
  }
  return (
    <ol className={styles.items}>
      {value.items.map((item, index) => (
        <li key={itemKeys?.get(item)}>
          <span className={styles.itemLabel}>Item {index + 1}</span>
          <PropertyValue value={item} />
        </li>
      ))}
    </ol>
  )
}

const PropertyFields = ({
  properties,
  nested = false,
}: {
  readonly properties: readonly MarkdownProperty[]
  readonly nested?: boolean
}) => (
  <dl className={styles.fields} data-nested={nested || undefined}>
    {properties.map(({ name, value }) => {
      const collection = value.kind === 'mapping' || value.kind === 'sequence'
      const count =
        value.kind === 'mapping'
          ? value.properties.length
          : value.kind === 'sequence'
            ? value.items.length
            : 0
      const wide =
        collection ||
        value.kind === 'alias' ||
        (value.kind === 'scalar' &&
          typeof value.value === 'string' &&
          (value.value.length > 40 ||
            value.value.includes('\n') ||
            zonedTime(value.value) !== null))
      return (
        <div key={name} className={styles.field} data-wide={wide || undefined}>
          <dt>{name}</dt>
          <dd>
            {collection ? (
              <details className={styles.nested}>
                <summary>
                  {count} {count === 1 ? 'item' : 'items'}
                </summary>
                <PropertyValue value={value} />
              </details>
            ) : (
              <PropertyValue value={value} />
            )}
          </dd>
        </div>
      )
    })}
  </dl>
)

export const MarkdownProperties = ({
  frontmatter,
}: {
  readonly frontmatter: MarkdownFrontmatter | null
}): ReactElement | null => {
  if (!frontmatter) return null
  return (
    <section aria-label="Document properties" className={styles.properties}>
      <details open>
        <summary className={styles.summary}>
          <span>
            Properties{frontmatter.status === 'valid' ? ` · ${frontmatter.properties.length}` : ''}
          </span>
        </summary>
        {frontmatter.status === 'valid' ? (
          <PropertyFields properties={frontmatter.properties} />
        ) : (
          <div className={styles.invalid}>
            <Banner tone="warning" inset>
              Properties could not be displayed. {frontmatter.message}
            </Banner>
            <pre className={styles.yaml}>
              <code>{frontmatter.raw}</code>
            </pre>
          </div>
        )}
      </details>
    </section>
  )
}
