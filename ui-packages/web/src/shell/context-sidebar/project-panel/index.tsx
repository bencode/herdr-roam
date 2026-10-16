import { GitCompareArrows } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useProjectWorkspaces } from '../../../features/project/use-project-workspaces'
import {
  readWorkspacePreference,
  writeWorkspacePreference,
} from '../../../features/project/workspace-preference'
import { Button } from '../../../ui/button'
import type { ProjectSection, ResourceRef } from '../../../workbench/resource'
import { FileTree } from './file-tree'
import { ResourceList } from './resource-list'
import { ProjectViewTabs } from './resource-tabs'
import { WorkspaceSelect } from './workspace-select'

type Props = {
  readonly activeProjectName: string
  readonly section: ProjectSection
  readonly routeKey: string
  readonly onOpen: (resource: ResourceRef) => void
  readonly activeCompare?: Extract<ResourceRef, { type: 'compare' }> | null
  readonly activeFile: Extract<ResourceRef, { type: 'file' }> | null
}

export const ProjectPanel = ({
  activeProjectName,
  section,
  routeKey,
  onOpen,
  activeFile,
  activeCompare,
}: Props) => {
  const [query, setQuery] = useState('')
  const [selectedSection, setSelectedSection] = useState(section)
  const [workspaceId, setWorkspaceId] = useState(() => readWorkspacePreference(activeProjectName))
  const workspaces = useProjectWorkspaces(activeProjectName)
  const routedKey = useRef(routeKey)
  const workspaceRoute = useRef('')

  useEffect(() => {
    if (workspaces.loading || workspaces.items.length === 0) return
    if (workspaces.items.some(workspace => workspace.id === workspaceId)) return
    const fallback = workspaces.items.find(workspace => workspace.primary) ?? workspaces.items[0]
    if (!fallback) return
    setWorkspaceId(fallback.id)
    writeWorkspacePreference(activeProjectName, fallback.id)
  }, [activeProjectName, workspaceId, workspaces.items, workspaces.loading])

  useEffect(() => {
    if (workspaceRoute.current === routeKey || workspaces.items.length === 0) return
    workspaceRoute.current = routeKey
    const routedWorkspaceId = activeFile?.workspaceId ?? activeCompare?.workspaceId
    if (!routedWorkspaceId || !workspaces.items.some(item => item.id === routedWorkspaceId)) return
    setWorkspaceId(routedWorkspaceId)
    writeWorkspacePreference(activeProjectName, routedWorkspaceId)
  }, [activeFile, activeCompare, activeProjectName, routeKey, workspaces.items])

  useEffect(() => {
    if (routedKey.current === routeKey) return
    routedKey.current = routeKey
    setSelectedSection(section)
    setQuery('')
  }, [routeKey, section])

  const activate = (next: ProjectSection) => {
    setSelectedSection(next)
    setQuery('')
  }

  const selectWorkspace = (nextWorkspaceId: string) => {
    setWorkspaceId(nextWorkspaceId)
    writeWorkspacePreference(activeProjectName, nextWorkspaceId)
    setQuery('')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="project-panel">
      <ProjectViewTabs value={selectedSection} onValueChange={activate} />
      {selectedSection === 'files' && (
        <div className="flex h-10 flex-none items-center justify-between gap-2 border-border border-b px-2">
          <WorkspaceSelect
            items={workspaces.items}
            value={workspaceId}
            onValueChange={selectWorkspace}
            showSingle
          />
          <Button
            size="compact"
            disabled={
              workspaces.loading ||
              workspaces.items.find(item => item.id === workspaceId)?.kind !== 'worktree'
            }
            onClick={() => onOpen({ type: 'compare', projectName: activeProjectName, workspaceId })}
            title="Compare committed branch changes"
          >
            <GitCompareArrows />
            Compare
          </Button>
        </div>
      )}
      {selectedSection === 'files' ? (
        <FileTree
          key={`${activeProjectName}:${workspaceId}`}
          projectName={activeProjectName}
          activeFile={activeFile}
          workspaceId={workspaceId}
          workspaces={workspaces}
          query={query}
          onQuery={setQuery}
          onOpen={onOpen}
        />
      ) : (
        <ResourceList
          projectName={activeProjectName}
          query={query}
          onQuery={setQuery}
          onOpen={onOpen}
        />
      )}
    </div>
  )
}
