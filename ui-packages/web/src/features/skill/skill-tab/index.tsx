import { Box, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { FileReader } from '../../../components/reader'
import type { ResourceRef } from '../../../workbench/resource'
import { skillTitle } from '../../../workbench/resource'
import { skillFileRawUrl, skillSourceLabel } from '../client'
import { useSkillDetail, useSkillFile } from '../use-skill-detail'
import { ResourceTree } from './resource-tree'
import styles from './style.module.scss'

type SkillResource = Extract<ResourceRef, { type: 'skill' }>

const ErrorState = ({
  title,
  message,
  onRetry,
}: {
  readonly title: string
  readonly message: string
  readonly onRetry: () => void
}) => (
  <div className={styles.error} role="status">
    <strong>{title}</strong>
    <span>{message}</span>
    <button type="button" onClick={onRetry}>
      Try again
    </button>
  </div>
)

export const SkillTab = ({ resource }: { readonly resource: SkillResource }) => {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const detail = useSkillDetail(resource)
  const selected = useSkillFile(resource, selectedPath)
  const file = selectedPath ? selected.value : detail.value?.document
  const error = selectedPath ? selected.error : detail.error
  const loading = selectedPath ? selected.loading : detail.loading
  const reload = () => {
    detail.reload()
    if (selectedPath) selected.reload()
    setRevision(value => value + 1)
  }
  const openPath = (path: string) => setSelectedPath(path === 'SKILL.md' ? null : path)

  return (
    <div className={styles.tab}>
      <header className={styles.header}>
        <Box aria-hidden="true" />
        <div className={styles.identity}>
          <div>
            <strong>{detail.value?.name ?? skillTitle(resource.skillId)}</strong>
            <span className={styles.badge}>
              {resource.scope === 'project' ? 'Project' : 'Personal'}
            </span>
            {detail.value && (
              <span className={styles.badge}>{skillSourceLabel(detail.value.source)}</span>
            )}
          </div>
          {detail.value && <span title={detail.value.location}>{detail.value.location}</span>}
        </div>
        <button
          type="button"
          className={styles.refresh}
          onClick={reload}
          disabled={loading}
          aria-label="Refresh Skill"
          title="Refresh Skill"
        >
          <RefreshCw aria-hidden="true" />
        </button>
      </header>
      <div className={styles.body}>
        <main className={styles.reader} aria-busy={loading}>
          {loading && !file ? (
            <div className={styles.status}>Loading Skill…</div>
          ) : error ? (
            <ErrorState
              title={selectedPath ? 'File unavailable' : 'Skill unavailable'}
              message={error.message}
              onRetry={selectedPath ? selected.reload : detail.reload}
            />
          ) : file ? (
            <FileReader
              file={file}
              rawUrl={path => skillFileRawUrl(resource, path)}
              onOpenPath={openPath}
              showOutline={false}
            />
          ) : null}
        </main>
        {detail.value && (
          <ResourceTree
            resource={resource}
            selectedPath={selectedPath}
            revision={revision}
            onSelect={setSelectedPath}
          />
        )}
      </div>
    </div>
  )
}
