import { useEffect, useRef, useState } from 'react'
import { useProjectWorkspaces } from '../../../features/project/use-project-workspaces'
import {
  readWorkspacePreference,
  writeWorkspacePreference,
} from '../../../features/project/workspace-preference'
import type { ProjectSection, ResourceRef } from '../../../workbench/resource'
import { FileTree } from './file-tree'
import { IssueBrowser } from './issue-browser'
import { ResourceList } from './resource-list'
import { ProjectViewTabs } from './resource-tabs'

type Props = {
  readonly activeProjectName: string
  readonly section: ProjectSection
  readonly routeKey: string
  readonly onOpen: (resource: ResourceRef) => void
  readonly activeFile: Extract<ResourceRef, { type: 'file' }> | null
  readonly activeIssue: Extract<ResourceRef, { type: 'issue' }> | null
}

export const ProjectPanel = ({
  activeProjectName,
  section,
  routeKey,
  onOpen,
  activeFile,
  activeIssue,
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
    const routedWorkspaceId = activeFile?.workspaceId ?? activeIssue?.workspaceId
    if (!routedWorkspaceId || !workspaces.items.some(item => item.id === routedWorkspaceId)) return
    setWorkspaceId(routedWorkspaceId)
    writeWorkspacePreference(activeProjectName, routedWorkspaceId)
  }, [activeFile, activeIssue, activeProjectName, routeKey, workspaces.items])

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
      {selectedSection === 'files' ? (
        <FileTree
          key={activeProjectName}
          projectName={activeProjectName}
          activeFile={activeFile}
          workspaceId={workspaceId}
          workspaces={workspaces}
          query={query}
          onQuery={setQuery}
          onWorkspace={selectWorkspace}
          onOpen={onOpen}
        />
      ) : selectedSection === 'issues' ? (
        <IssueBrowser
          projectName={activeProjectName}
          workspaceId={workspaceId}
          workspaces={workspaces}
          activeIssue={activeIssue}
          query={query}
          onQuery={setQuery}
          onWorkspace={selectWorkspace}
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
