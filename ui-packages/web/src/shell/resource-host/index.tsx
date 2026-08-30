import { Activity } from 'react'
import { AgentTab } from '../../features/agent/agent-tab'
import { FileTab } from '../../features/file/file-tab'
import { IssueTab } from '../../features/issue/issue-tab'
import { RuntimeSettings } from '../../features/runtime/runtime-settings'
import { SessionTab } from '../../features/session/session-tab'
import { SkillTab } from '../../features/skill/skill-tab'
import { WorkbenchHome } from '../../features/workbench/workbench-home'
import {
  type ResourceRef,
  resourceKey,
  sameResource,
  type UtilityRef,
} from '../../workbench/resource'

const ResourceContent = ({
  resource,
  onOpen,
}: {
  readonly resource: ResourceRef
  readonly onOpen: (resource: ResourceRef) => void
}) => {
  if (resource.type === 'agent') return <AgentTab resource={resource} />
  if (resource.type === 'session') return <SessionTab resource={resource} onOpen={onOpen} />
  if (resource.type === 'issue') return <IssueTab resource={resource} onOpen={onOpen} />
  if (resource.type === 'file') return <FileTab resource={resource} />
  return <SkillTab resource={resource} />
}

export const ResourceHost = ({
  project,
  projects,
  projectConfigPath,
  projectError,
  tabs,
  active,
  activeUtility,
  onOpen,
  onAddProject,
}: {
  readonly project: Project | null
  readonly projects: readonly Project[]
  readonly projectConfigPath: string | null
  readonly projectError: string | null
  readonly tabs: readonly ResourceRef[]
  readonly active: ResourceRef | null
  readonly activeUtility: UtilityRef | null
  readonly onOpen: (resource: ResourceRef) => void
  readonly onAddProject: (request: ProjectCreateRequest) => Promise<void>
}) => (
  <main className="relative min-h-0 min-w-0 flex-1 bg-surface">
    <Activity
      mode={active === null && activeUtility === null ? 'visible' : 'hidden'}
      name="workbench"
    >
      <div className="absolute inset-0 overflow-hidden">
        {project && <WorkbenchHome project={project} onOpen={onOpen} />}
      </div>
    </Activity>
    {tabs.map(resource => (
      <Activity
        key={resourceKey(resource)}
        mode={active && sameResource(active, resource) ? 'visible' : 'hidden'}
        name={resourceKey(resource)}
      >
        <div className="absolute inset-0 overflow-hidden">
          <ResourceContent resource={resource} onOpen={onOpen} />
        </div>
      </Activity>
    ))}
    <Activity mode={activeUtility === 'runtime' ? 'visible' : 'hidden'} name="runtime-settings">
      <div className="absolute inset-0 overflow-hidden">
        <RuntimeSettings
          projects={projects}
          configPath={projectConfigPath}
          projectError={projectError}
          onAddProject={onAddProject}
        />
      </div>
    </Activity>
  </main>
)
import type { Project, ProjectCreateRequest } from '@herdr-roam/shared'
