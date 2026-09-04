import { FileCode2, RefreshCw } from 'lucide-react'
import { FileReader } from '../../../components/reader'
import type { ResourceRef } from '../../../workbench/resource'
import { projectFileRawUrl } from '../client'
import { useFileView } from '../use-file-view'
import styles from './style.module.scss'

const fileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MiB`
}

export const FileTab = ({
  resource,
  active,
  onOpen,
}: {
  readonly resource: Extract<ResourceRef, { type: 'file' }>
  readonly active: boolean
  readonly onOpen: (resource: ResourceRef) => void
}) => {
  const state = useFileView(resource.projectName, resource.path, active)
  const rawUrl = (path: string) => projectFileRawUrl(resource.projectName, path)

  return (
    <div className={styles.tab}>
      <header className={styles.header}>
        <FileCode2 aria-hidden="true" />
        <div className={styles.identity}>
          <strong>{resource.path.split('/').at(-1) ?? resource.path}</strong>
          <span title={resource.path}>{resource.path}</span>
        </div>
        {state.value && (
          <span className={styles.metadata}>
            {fileSize(state.value.size)} · {state.value.mediaType}
          </span>
        )}
        <button
          type="button"
          className={styles.refresh}
          onClick={state.reload}
          disabled={state.loading}
          aria-label="Refresh file"
          title="Refresh file"
        >
          <RefreshCw aria-hidden="true" />
        </button>
      </header>
      <div className={styles.body} aria-busy={state.loading}>
        {state.loading && !state.value ? (
          <div className={styles.status}>Loading file…</div>
        ) : state.error ? (
          <div className={styles.error} role="status">
            <strong>File unavailable</strong>
            <span>{state.error.message}</span>
            <button type="button" onClick={state.reload}>
              Try again
            </button>
          </div>
        ) : state.value ? (
          <FileReader
            file={state.value}
            rawUrl={rawUrl}
            onOpenPath={path => onOpen({ type: 'file', projectName: resource.projectName, path })}
          />
        ) : null}
      </div>
    </div>
  )
}
