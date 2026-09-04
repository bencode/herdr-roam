import type { FileView } from '@herdr-roam/shared'
import { lazy, Suspense } from 'react'
import styles from './style.module.scss'

const CodeReader = lazy(() =>
  import('./code-reader').then(module => ({ default: module.CodeReader })),
)
const HtmlReader = lazy(() =>
  import('./html-reader').then(module => ({ default: module.HtmlReader })),
)
const ImageReader = lazy(() =>
  import('./image-reader').then(module => ({ default: module.ImageReader })),
)
const MarkdownReader = lazy(() =>
  import('./markdown-reader').then(module => ({ default: module.MarkdownReader })),
)

const ReaderLoading = () => <div className={styles.centered}>Loading preview…</div>

export const FileReader = ({
  file,
  rawUrl,
  onOpenPath,
  showOutline = true,
}: {
  readonly file: FileView
  readonly rawUrl: (path: string) => string
  readonly onOpenPath: (path: string) => void
  readonly showOutline?: boolean
}) => {
  if (file.kind === 'binary') {
    return <div className={styles.centered}>This binary file cannot be previewed.</div>
  }
  if (file.kind === 'oversized') {
    return (
      <div className={styles.centered}>
        This {file.previewKind} is larger than the {Math.round(file.limit / 1024 / 1024)} MiB
        preview limit.
      </div>
    )
  }

  return (
    <Suspense fallback={<ReaderLoading />}>
      {file.kind === 'markdown' ? (
        <MarkdownReader
          file={file}
          rawUrl={rawUrl}
          onOpenPath={onOpenPath}
          showOutline={showOutline}
        />
      ) : file.kind === 'html' ? (
        <HtmlReader file={file} rawUrl={rawUrl} />
      ) : file.kind === 'image' ? (
        <ImageReader file={file} src={rawUrl(file.path)} />
      ) : file.kind === 'mermaid' ? (
        <MarkdownReader
          file={{ ...file, kind: 'markdown', content: `\`\`\`mermaid\n${file.content}\n\`\`\`` }}
          rawUrl={rawUrl}
          onOpenPath={onOpenPath}
          showOutline={showOutline}
        />
      ) : (
        <CodeReader content={file.content} language={file.language} />
      )}
    </Suspense>
  )
}
