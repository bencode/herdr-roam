import { useEffect, useRef, useState } from 'react'
import type { ProjectSection, ResourceRef } from '../../../workbench/resource'
import { FileTree } from './file-tree'
import { ResourceList } from './resource-list'
import { ProjectViewTabs } from './resource-tabs'

type Props = {
  readonly activeProjectName: string
  readonly section: ProjectSection
  readonly routeKey: string
  readonly onOpen: (resource: ResourceRef) => void
  readonly activeFile: Extract<ResourceRef, { type: 'file' }> | null
}

export const ProjectPanel = ({
  activeProjectName,
  section,
  routeKey,
  onOpen,
  activeFile,
}: Props) => {
  const [query, setQuery] = useState('')
  const [selectedSection, setSelectedSection] = useState(section)
  const routedKey = useRef(routeKey)

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

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="project-panel">
      <ProjectViewTabs value={selectedSection} onValueChange={activate} />
      {selectedSection === 'files' ? (
        <FileTree
          key={activeProjectName}
          projectName={activeProjectName}
          activeFile={activeFile}
          routeKey={routeKey}
          query={query}
          onQuery={setQuery}
          onOpen={onOpen}
        />
      ) : (
        <ResourceList
          section={selectedSection}
          projectName={activeProjectName}
          query={query}
          onQuery={setQuery}
          onOpen={onOpen}
        />
      )}
    </div>
  )
}
