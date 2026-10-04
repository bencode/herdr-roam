import { FileCode2, RefreshCw } from 'lucide-react'
import { FileReader } from '../../../components/reader'
import { MarkdownControls } from '../../../components/reader/markdown-controls'
import { isMarkdownLike, useMarkdownView } from '../../../components/reader/markdown-view'
import { Button } from '../../../ui/button'
import { DetailHeader } from '../../../ui/detail-header'
import { EmptyState } from '../../../ui/empty-state'
import type { ResourceRef } from '../../../workbench/resource'
import { projectFileRawUrl } from '../client'
import { useFileView } from '../use-file-view'

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
  const state = useFileView(resource.projectName, resource.workspaceId, resource.path, active)
  const markdownView = useMarkdownView()
  const name = resource.path.split('/').at(-1) ?? resource.path
  const rawUrl = (path: string) =>
    projectFileRawUrl(resource.projectName, resource.workspaceId, path)

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <DetailHeader
        icon={<FileCode2 aria-hidden="true" />}
        title={name}
        detail={resource.path === name ? undefined : resource.path}
        meta={
          state.value && (
            <span className="whitespace-nowrap">
              {fileSize(state.value.size)} · {state.value.mediaType}
            </span>
          )
        }
        actions={
          <>
            {state.value && isMarkdownLike(state.value) && (
              <MarkdownControls view={markdownView} showOutlineToggle />
            )}
            <Button
              size="compactIcon"
              onClick={state.reload}
              disabled={state.loading}
              aria-label="Refresh file"
              title="Refresh file"
            >
              <RefreshCw aria-hidden="true" />
            </Button>
          </>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-auto" aria-busy={state.loading}>
        {state.loading && !state.value ? (
          <p className="m-0 px-4 py-16 text-center text-xs text-muted" role="status">
            Loading file…
          </p>
        ) : state.error ? (
          <EmptyState
            className="min-h-64 content-center"
            title="File unavailable"
            role="status"
            action={
              <Button size="compact" variant="secondary" onClick={state.reload}>
                Try again
              </Button>
            }
          >
            {state.error.message}
          </EmptyState>
        ) : state.value ? (
          <FileReader
            file={state.value}
            rawUrl={rawUrl}
            markdownView={markdownView}
            onOpenPath={path =>
              onOpen({
                type: 'file',
                projectName: resource.projectName,
                workspaceId: resource.workspaceId,
                path,
              })
            }
          />
        ) : null}
      </div>
    </div>
  )
}
