import type { ProjectFileView } from '@herdr-roam/shared'
import { lazy, Suspense, useState } from 'react'
import styles from './style.module.scss'

const CodeReader = lazy(() =>
  import('./code-reader').then(module => ({ default: module.CodeReader })),
)
type HtmlFile = Extract<ProjectFileView, { kind: 'html' }>

const escapedAttribute = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')

export const HtmlReader = ({
  file,
  rawUrl,
}: {
  readonly file: HtmlFile
  readonly rawUrl: (path: string) => string
}) => {
  const [mode, setMode] = useState<'preview' | 'source'>('preview')
  const base = new URL('.', new URL(rawUrl(file.path), globalThis.location.origin)).href
  const origin = globalThis.location.origin
  const policy = `default-src 'none'; img-src ${origin} data:; style-src ${origin} 'unsafe-inline'; font-src ${origin} data:`
  const document = `<meta http-equiv="Content-Security-Policy" content="${policy}"><base href="${escapedAttribute(base)}">${file.content}`

  return (
    <div className={styles.htmlReader}>
      <fieldset className={styles.modeBar}>
        <legend className="sr-only">HTML view</legend>
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
      {mode === 'preview' ? (
        <iframe
          className={styles.htmlFrame}
          title={`Preview of ${file.name}`}
          sandbox=""
          srcDoc={document}
        />
      ) : (
        <Suspense fallback={<div className={styles.centered}>Loading source…</div>}>
          <CodeReader content={file.content} language="html" />
        </Suspense>
      )}
    </div>
  )
}
