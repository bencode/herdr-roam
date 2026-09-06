import { Activity } from 'react'
import { AgentList } from '../../features/agent/agent-list'
import { SkillList } from '../../features/skill/skill-list'
import type { GlobalDimension, ProjectSection, ResourceRef } from '../../workbench/resource'
import { ProjectPanel } from './project-panel'

type Props = {
  readonly dimension: GlobalDimension
  readonly activeProjectName: string
  readonly activeAgentId: string | null
  readonly activeFile: Extract<ResourceRef, { type: 'file' }> | null
  readonly activeIssue: Extract<ResourceRef, { type: 'issue' }> | null
  readonly activeSkill: Extract<ResourceRef, { type: 'skill' }> | null
  readonly projectSection: ProjectSection
  readonly projectRouteKey: string
  readonly onOpen: (resource: ResourceRef) => void
}

export const ContextSidebar = (props: Props) => {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Activity
        name="projects-sidebar"
        mode={props.dimension === 'projects' ? 'visible' : 'hidden'}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {props.activeProjectName ? (
            <ProjectPanel
              key={props.activeProjectName}
              activeProjectName={props.activeProjectName}
              activeFile={props.activeFile}
              activeIssue={props.activeIssue}
              section={props.projectSection}
              routeKey={props.projectRouteKey}
              onOpen={props.onOpen}
            />
          ) : (
            <p className="m-0 px-4 py-5 text-xs text-muted">No project selected.</p>
          )}
        </div>
      </Activity>
      <Activity name="agents-sidebar" mode={props.dimension === 'agents' ? 'visible' : 'hidden'}>
        <AgentList activeAgentId={props.activeAgentId} onOpen={props.onOpen} />
      </Activity>
      <Activity name="skills-sidebar" mode={props.dimension === 'skills' ? 'visible' : 'hidden'}>
        <SkillList
          projectName={props.activeProjectName}
          active={props.activeSkill}
          onOpen={props.onOpen}
        />
      </Activity>
    </div>
  )
}
