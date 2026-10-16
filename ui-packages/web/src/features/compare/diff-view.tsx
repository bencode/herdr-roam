import type { CompareFileView } from '@herdr-roam/shared'
import type { DiffFileInput, FileDiff as DiffInstance, FileDiffOptions } from '@pierre/diffs'
import { MultiFileDiff } from '@pierre/diffs/react'
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import { registerCompareTheme } from './diff-theme'
import styles from './style.module.scss'

registerCompareTheme()

export type DiffMode = 'split' | 'unified'

const engineCSS = `
:host {
  --diffs-font-family: var(--font-code);
  --diffs-font-size: 12px;
  --diffs-line-height: 21px;
  --diffs-gap-block: 0px;
  --diffs-gap-inline: 8px;
  --diffs-bg: var(--surface);
  --diffs-fg: var(--foreground);
  --diffs-fg-number: var(--faint);
  --diffs-addition-base: var(--success);
  --diffs-deletion-base: var(--danger);
  --diffs-modified-base: var(--primary);
  --diffs-bg-addition: color-mix(in oklab, var(--success) 9%, var(--surface));
  --diffs-bg-deletion: color-mix(in oklab, var(--danger) 7%, var(--surface));
  --diffs-bg-addition-number: color-mix(in oklab, var(--success) 14%, var(--surface));
  --diffs-bg-deletion-number: color-mix(in oklab, var(--danger) 12%, var(--surface));
  --diffs-bg-addition-emphasis: color-mix(in oklab, var(--success) 22%, var(--surface));
  --diffs-bg-deletion-emphasis: color-mix(in oklab, var(--danger) 20%, var(--surface));
  --diffs-bg-buffer: var(--sidebar);
  --diffs-bg-hover: var(--hover);
  --diffs-selection: var(--primary-soft);
}
:host, pre { color-scheme: inherit; }
[data-separator] { font-family: var(--font-sans); font-size: 11px; }
[data-line] { min-height: 21px; }
`

export type DiffBookmark = {
  readonly line: number
  readonly side: 'additions' | 'deletions'
  readonly offset: number
  readonly top: number
  readonly left: number
}

type Props = {
  readonly file: Extract<CompareFileView, { kind: 'text' }>
  readonly mode: DiffMode
  readonly wrap: boolean
  readonly bookmark?: DiffBookmark
  readonly onBookmark?: (value: DiffBookmark) => void
}

export const DiffView = ({ file, mode, wrap, bookmark, onBookmark }: Props) => {
  const scroll = useRef<HTMLDivElement>(null)
  const rendered = useRef<{ node: HTMLElement; instance: DiffInstance } | null>(null)
  const saved = useRef(bookmark)
  const restored = useRef(false)
  const notify = useRef(onBookmark)
  useLayoutEffect(() => {
    notify.current = onBookmark
  }, [onBookmark])
  const capture = useCallback(() => {
    const viewport = scroll.current
    const current = rendered.current
    if (!viewport || !current || !restored.current) return
    const top = viewport.getBoundingClientRect().top
    const line = Array.from(
      current.node.shadowRoot?.querySelectorAll<HTMLElement>('[data-line]') ?? [],
    ).find(node => node.getBoundingClientRect().bottom > top)
    const value: DiffBookmark = {
      line: Number(line?.dataset.line ?? 1),
      side:
        line?.closest('[data-deletions]') || line?.dataset.lineType === 'deletion'
          ? 'deletions'
          : 'additions',
      offset: line ? line.getBoundingClientRect().top - top : 0,
      top: viewport.scrollTop,
      left: current.instance.getCodeScrollLeft(),
    }
    saved.current = value
    notify.current?.(value)
  }, [])
  const onPostRender = useCallback<
    NonNullable<FileDiffOptions<undefined, undefined>['onPostRender']>
  >(
    (node, instance, phase) => {
      if (phase === 'unmount') {
        capture()
        node.shadowRoot?.removeEventListener('scroll', capture, true)
        restored.current = false
        rendered.current = null
        return
      }
      if (phase === 'mount') node.shadowRoot?.addEventListener('scroll', capture, true)
      rendered.current = { node, instance }
      if (restored.current) return
      restored.current = true
      const previous = saved.current
      if (!previous) return
      const selector = `[data-line="${previous.line}"]`
      if (!node.shadowRoot?.querySelector(selector)) {
        if (previous.side === 'additions') instance.revealLine(previous.line)
        else {
          const hunks = instance.fileDiff?.hunks ?? []
          const next = hunks.findIndex(hunk => hunk.deletionStart > previous.line)
          if (next >= 0)
            instance.expandHunk(
              next,
              'up',
              (hunks[next]?.deletionStart ?? previous.line) - previous.line + 3,
            )
          else if (hunks.length) instance.expandHunk(hunks.length - 1, 'down', previous.line)
        }
      }
      requestAnimationFrame(() => {
        const viewport = scroll.current
        if (!viewport || rendered.current?.node !== node) return
        const candidates = Array.from(
          node.shadowRoot?.querySelectorAll<HTMLElement>(selector) ?? [],
        )
        const anchor =
          candidates.find(line =>
            previous.side === 'deletions'
              ? line.closest('[data-deletions]') || line.dataset.lineType === 'deletion'
              : !line.closest('[data-deletions]') && line.dataset.lineType !== 'deletion',
          ) ?? candidates[0]
        viewport.scrollTop = anchor
          ? viewport.scrollTop +
            anchor.getBoundingClientRect().top -
            viewport.getBoundingClientRect().top -
            previous.offset
          : previous.top
        instance.setCodeScrollLeft(previous.left)
      })
    },
    [capture],
  )
  const input = useMemo<DiffFileInput | null>(() => {
    const oldFile = file.oldFile && { name: file.oldFile.path, contents: file.oldFile.content }
    const newFile = file.newFile && { name: file.newFile.path, contents: file.newFile.content }
    if (oldFile) return { oldFile, newFile }
    return newFile ? { oldFile: null, newFile } : null
  }, [file])
  const options = useMemo<FileDiffOptions<undefined, undefined>>(
    () => ({
      theme: { light: 'roam', dark: 'roam' },
      themeType: 'system',
      diffStyle: mode,
      overflow: wrap ? 'wrap' : 'scroll',
      disableFileHeader: true,
      diffIndicators: 'classic',
      hunkSeparators: 'line-info-basic',
      expansionLineCount: 20,
      unsafeCSS: engineCSS,
      onPostRender,
    }),
    [mode, wrap, onPostRender],
  )
  if (!input) return null
  return (
    <div ref={scroll} onScroll={capture} className={styles.diffScroll}>
      <div className={styles.engine}>
        <MultiFileDiff
          key={`${mode}:${wrap}`}
          {...input}
          options={options}
          style={{ colorScheme: 'inherit' }}
        />
      </div>
    </div>
  )
}
