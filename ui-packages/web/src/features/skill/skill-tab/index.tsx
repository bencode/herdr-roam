import { Box, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { FileReader } from '../../../components/reader'
import { MarkdownControls } from '../../../components/reader/markdown-controls'
import { isMarkdownLike, useMarkdownView } from '../../../components/reader/markdown-view'
import { Badge } from '../../../ui/badge'
import { Button } from '../../../ui/button'
import { DetailHeader } from '../../../ui/detail-header'
import { EmptyState } from '../../../ui/empty-state'
import type { ResourceRef } from '../../../workbench/resource'
import { skillTitle } from '../../../workbench/resource'
import { skillFileRawUrl, skillSourceLabel } from '../client'
import { useSkillDetail, useSkillFile } from '../use-skill-detail'
import { ResourceTree } from './resource-tree'

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
  <EmptyState
    className="min-h-64 flex-1 content-center"
    title={title}
    role="status"
    action={
      <Button size="compact" variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    }
  >
    {message}
  </EmptyState>
)

export const SkillTab = ({ resource }: { readonly resource: SkillResource }) => {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const detail = useSkillDetail(resource)
  const selected = useSkillFile(resource, selectedPath)
  const file = selectedPath ? selected.value : detail.value?.document
  const error = selectedPath ? selected.error : detail.error
  const loading = selectedPath ? selected.loading : detail.loading
  const markdownView = useMarkdownView()
  const reload = () => {
    detail.reload()
    if (selectedPath) selected.reload()
    setRevision(value => value + 1)
  }
  const openPath = (path: string) => setSelectedPath(path === 'SKILL.md' ? null : path)

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <DetailHeader
        icon={<Box aria-hidden="true" />}
        title={detail.value?.name ?? skillTitle(resource.skillId)}
        detail={detail.value?.location}
        meta={
          <>
            <Badge>{resource.scope === 'project' ? 'Project' : 'Personal'}</Badge>
            {detail.value && <Badge>{skillSourceLabel(detail.value.source)}</Badge>}
          </>
        }
        actions={
          <>
            {file && isMarkdownLike(file) && (
              <MarkdownControls view={markdownView} showOutlineToggle={false} />
            )}
            <Button
              size="compactIcon"
              onClick={reload}
              disabled={loading}
              aria-label="Refresh Skill"
              title="Refresh Skill"
            >
              <RefreshCw aria-hidden="true" />
            </Button>
          </>
        }
      />
      <div className="@container grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_14rem] @max-[54rem]:grid-cols-[minmax(0,1fr)] @max-[54rem]:grid-rows-[auto_minmax(0,1fr)]">
        <main
          className="flex min-h-0 min-w-0 overflow-hidden @max-[54rem]:row-start-2"
          aria-busy={loading}
        >
          {loading && !file ? (
            <p className="m-0 flex-1 px-4 py-16 text-center text-xs text-muted" role="status">
              Loading Skill…
            </p>
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
              markdownView={markdownView}
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
