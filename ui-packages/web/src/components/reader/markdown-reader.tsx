import type { FileView } from '@herdr-roam/shared'
import type { CSSProperties } from 'react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Markdown } from '../markdown'
import { parseMarkdownDocument } from './frontmatter'
import { MarkdownControls } from './markdown-controls'
import type { MarkdownHeading } from './markdown-outline'
import { MarkdownOutline } from './markdown-outline'
import { MarkdownProperties } from './markdown-properties'
import type { MarkdownView } from './markdown-view'
import { useReadingPreferences } from './reading-preferences'
import styles from './style.module.scss'

const CodeReader = lazy(() =>
  import('./code-reader').then(module => ({ default: module.CodeReader })),
)

type MarkdownFile = Extract<FileView, { kind: 'markdown' }>

const COMPACT_WIDTH_REM = 53.75
const ACTIVE_HEADING_OFFSET = 24

const slug = (text: string): string =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
    .replace(/\s+/g, '-') || 'section'

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
  view,
}: {
  readonly file: MarkdownFile
  readonly rawUrl: (path: string) => string
  readonly onOpenPath: (path: string) => void
  readonly showOutline: boolean
  readonly view: MarkdownView
}) => {
  const { mode, outlineOpen, setOutlineOpen } = view
  const { fontSize, width, theme } = useReadingPreferences()
  const parsedDocument = useMemo(() => parseMarkdownDocument(file.content), [file.content])
  const leadingContent = useMemo(
    () =>
      parsedDocument.frontmatter ? (
        <MarkdownProperties key={file.path} frontmatter={parsedDocument.frontmatter} />
      ) : undefined,
    [file.path, parsedDocument.frontmatter],
  )
  const [headings, setHeadings] = useState<readonly MarkdownHeading[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [compact, setCompact] = useState<boolean | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLElement>(null)
  const compactRef = useRef<boolean | null>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const remPx = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const measure = () => {
      if (root.clientWidth === 0) return
      const next = root.clientWidth < COMPACT_WIDTH_REM * remPx
      if (compactRef.current === next) return
      compactRef.current = next
      setCompact(next)
      setOutlineOpen(!next)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    measure()
    return () => observer.disconnect()
  }, [setOutlineOpen])

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

  useEffect(() => {
    const scroller = contentRef.current
    if (mode !== 'preview' || !scroller || headings.length === 0) {
      setActiveId(null)
      return
    }
    let frame = 0
    const updateActive = () => {
      frame = 0
      const top = scroller.getBoundingClientRect().top + ACTIVE_HEADING_OFFSET
      const passed = headings.filter(heading => {
        const element = scroller.querySelector(`#${CSS.escape(heading.id)}`)
        return element ? element.getBoundingClientRect().top <= top : false
      })
      setActiveId((passed.at(-1) ?? headings[0])?.id ?? null)
    }
    const scheduleUpdate = () => {
      if (frame === 0) frame = requestAnimationFrame(updateActive)
    }
    updateActive()
    scroller.addEventListener('scroll', scheduleUpdate, { passive: true })
    return () => {
      scroller.removeEventListener('scroll', scheduleUpdate)
      cancelAnimationFrame(frame)
    }
  }, [headings, mode])

  const selectHeading = useCallback((id: string) => {
    const scroller = contentRef.current
    const heading = scroller?.querySelector(`#${CSS.escape(id)}`)
    if (!scroller || !heading) return
    scroller.scrollTo({
      top:
        heading.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop -
        ACTIVE_HEADING_OFFSET,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
    setActiveId(id)
  }, [])

  const closeOutline = useCallback(() => {
    setOutlineOpen(false)
    rootRef.current
      ?.querySelector<HTMLButtonElement>('[aria-label="Toggle outline"]')
      ?.focus({ preventScroll: true })
  }, [setOutlineOpen])
  const outlineVisible = showOutline && outlineOpen && compact !== null

  const handleLink = useCallback(
    (href: string): boolean => {
      if (href.startsWith('#')) {
        selectHeading(href.slice(1))
        return true
      }
      const path = localPath(file.path, href)
      if (!path) return false
      onOpenPath(path)
      return true
    },
    [file.path, onOpenPath, selectHeading],
  )

  const imageSource = useCallback(
    (src: string): string => {
      const path = localPath(file.path, src)
      return path ? rawUrl(path) : src
    },
    [file.path, rawUrl],
  )

  return (
    <div
      ref={rootRef}
      className={styles.markdownReader}
      data-reading-theme={theme}
      data-width={width}
      style={{ '--reading-font-size': `${fontSize}px` } as CSSProperties}
    >
      <MarkdownControls view={view} showOutlineToggle={showOutline && headings.length > 0} />
      {mode === 'source' ? (
        <Suspense fallback={<div className={styles.centered}>Loading source…</div>}>
          <CodeReader content={file.content} language="markdown" />
        </Suspense>
      ) : (
        <div
          className={styles.markdownLayout}
          data-outline={(outlineVisible && !compact) || undefined}
        >
          {outlineVisible && !compact && (
            <MarkdownOutline
              headings={headings}
              activeId={activeId}
              variant="column"
              onSelect={selectHeading}
              onClose={closeOutline}
            />
          )}
          <article ref={contentRef} className={styles.markdownContent}>
            <div className={styles.documentColumn}>
              <Markdown
                text={parsedDocument.body}
                leadingContent={leadingContent}
                className={styles.documentMarkdown}
                resolveImageSrc={imageSource}
                onLink={handleLink}
              />
            </div>
          </article>
        </div>
      )}
      {mode === 'preview' && outlineVisible && compact && (
        <MarkdownOutline
          headings={headings}
          activeId={activeId}
          variant="drawer"
          onSelect={selectHeading}
          onClose={closeOutline}
        />
      )}
    </div>
  )
}
