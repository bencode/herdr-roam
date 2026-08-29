import { useState } from 'react'
import type { ResourceRef } from '../../../workbench/resource'
import { FileTree } from './file-tree'
import { type ProjectSection, ResourceList } from './resource-list'
import { ProjectViewTabs } from './resource-tabs'

type Props = {
  readonly activeProjectName: string
  readonly onOpen: (resource: ResourceRef) => void
}

export const ProjectPanel = ({ activeProjectName, onOpen }: Props) => {
  const [section, setSection] = useState<ProjectSection>('sessions')
  const [query, setQuery] = useState('')

  const activate = (next: ProjectSection) => {
    setSection(next)
    setQuery('')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="project-panel">
      <ProjectViewTabs value={section} onValueChange={activate} />
      {section === 'files' ? (
        <FileTree
          projectName={activeProjectName}
          query={query}
          onQuery={setQuery}
          onOpen={onOpen}
        />
      ) : (
        <ResourceList
          section={section}
          projectName={activeProjectName}
          query={query}
          onQuery={setQuery}
          onOpen={onOpen}
        />
      )}
    </div>
  )
}
