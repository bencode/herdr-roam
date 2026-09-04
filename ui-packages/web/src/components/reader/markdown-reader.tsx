import type { FileView } from '@herdr-roam/shared'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Markdown } from '../markdown'
import type { MarkdownHeading } from './markdown-outline'
import { MarkdownOutline } from './markdown-outline'
import styles from './style.module.scss'

const CodeReader = lazy(() =>
  import('./code-reader').then(module => ({ default: module.CodeReader })),
)

type MarkdownFile = Extract<FileView, { kind: 'markdown' }>
type Mode = 'preview' | 'source'

const slug = (text: string): string =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-') || 'section'

const previewContent = (content: string): string => {
  const lines = content.split(/\r?\n/)
  if (lines[0] !== '---') return content

  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && (line === '---' || line === '...'),
  )
  return closingIndex < 0 ? content : lines.slice(closingIndex + 1).join('\n').replace(/^\n/, '')
}

const localPath = (currentPath: string, href: string): string | null => {
  if (/^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith('//')) return null
  const rawPath = href.split(/[?#]/, 1)[0] ?? ''
  if (!rawPath) return null
  let decoded: string
  try {
    decoded = decodeURIComponent(rawPath)
  } catch (error) {
    console.error('Markdown link could not be decoded', error)
    return null
  }
  const parts = decoded.startsWith('/') ? [] : currentPath.split('/').slice(0, -1)
  for (const part of decoded.replace(/^\//, '').split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (parts.length === 0) return null
      parts.pop()
    } else {
      parts.push(part)
    }
  }
  return parts.join('/') || null
}

export const MarkdownReader = ({
  file,
  rawUrl,
  onOpenPath,
  showOutline,
}: {
  readonly file: MarkdownFile
  readonly rawUrl: (path: string) => string
  readonly onOpenPath: (path: string) => void
  readonly showOutline: boolean
}) => {
  const [mode, setMode] = useState<Mode>('preview')
  const [headings, setHeadings] = useState<readonly MarkdownHeading[]>([])
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (mode !== 'preview') return
    if (file.content.length === 0) {
      setHeadings([])
      return
    }
    const counts = new Map<string, number>()
    const values = [...(contentRef.current?.querySelectorAll('h1,h2,h3,h4,h5,h6') ?? [])].map(
      heading => {
        const base = slug(heading.textContent ?? '')
        const count = counts.get(base) ?? 0
        counts.set(base, count + 1)
        const id = count === 0 ? base : `${base}-${count + 1}`
        heading.id = id
        return { id, level: Number(heading.tagName.slice(1)), label: heading.textContent ?? id }
      },
    )
    setHeadings(values)
  }, [file.content, mode])

  const selectHeading = (id: string) =>
    contentRef.current?.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ behavior: 'smooth' })

  const handleLink = (href: string): boolean => {
    if (href.startsWith('#')) {
      selectHeading(href.slice(1))
      return true
    }
    const path = localPath(file.path, href)
    if (!path) return false
    onOpenPath(path)
    return true
  }

  const imageSource = (src: string): string => {
    const path = localPath(file.path, src)
    return path ? rawUrl(path) : src
  }

  return (
    <div className={styles.markdownReader}>
      <fieldset className={styles.modeBar}>
        <legend className="sr-only">Markdown view</legend>
        {(['preview', 'source'] as const).map(value => (
          <button
            type="button"
            key={value}
            data-active={mode === value || undefined}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
          >
            {value}
          </button>
        ))}
      </fieldset>
      {mode === 'source' ? (
        <Suspense fallback={<div className={styles.centered}>Loading source…</div>}>
          <CodeReader content={file.content} language="markdown" />
        </Suspense>
      ) : (
        <div className={styles.markdownLayout} data-outline={showOutline || undefined}>
          <article ref={contentRef} className={styles.markdownContent}>
            <Markdown
              text={previewContent(file.content)}
              className={styles.documentMarkdown}
              resolveImageSrc={imageSource}
              onLink={handleLink}
            />
          </article>
          {showOutline && <MarkdownOutline headings={headings} onSelect={selectHeading} />}
        </div>
      )}
    </div>
  )
}
