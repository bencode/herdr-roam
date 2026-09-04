import type { Project } from '@herdr-roam/shared'
import { Activity } from 'react'
import { AgentTab } from '../../features/agent/agent-tab'
import { FileTab } from '../../features/file/file-tab'
import { IssueTab } from '../../features/issue/issue-tab'
import { SessionTab } from '../../features/session/session-tab'
import { SkillTab } from '../../features/skill/skill-tab'
import { WorkbenchHome } from '../../features/workbench/workbench-home'
import { type ResourceRef, resourceKey, sameResource } from '../../workbench/resource'

const ResourceContent = ({
  resource,
  projects,
  focusMode,
  onFocusModeChange,
  onOpen,
  active,
}: {
  readonly resource: ResourceRef
  readonly projects: readonly Project[]
  readonly focusMode: boolean
  readonly onFocusModeChange: (focused: boolean) => void
  readonly onOpen: (resource: ResourceRef) => void
  readonly active: boolean
}) => {
  if (resource.type === 'agent')
    return <AgentTab resource={resource} projects={projects} onOpen={onOpen} />
  if (resource.type === 'session')
    return (
      <SessionTab
        resource={resource}
        focusMode={focusMode}
        onFocusModeChange={onFocusModeChange}
        onOpen={onOpen}
      />
    )
  if (resource.type === 'issue') return <IssueTab resource={resource} onOpen={onOpen} />
  if (resource.type === 'file')
    return <FileTab resource={resource} active={active} onOpen={onOpen} />
  return <SkillTab resource={resource} />
}

export const ResourceHost = ({
  project,
  projects,
  tabs,
  active,
  focusMode,
  onFocusModeChange,
  onOpen,
}: {
  readonly project: Project | null
  readonly projects: readonly Project[]
  readonly tabs: readonly ResourceRef[]
  readonly active: ResourceRef | null
  readonly focusMode: boolean
  readonly onFocusModeChange: (focused: boolean) => void
  readonly onOpen: (resource: ResourceRef) => void
}) => (
  <main className="relative min-h-0 min-w-0 flex-1 bg-surface">
    <Activity mode={active === null ? 'visible' : 'hidden'} name="workbench">
      <div className="absolute inset-0 overflow-hidden">
        {project ? (
          <WorkbenchHome project={project} onOpen={onOpen} />
        ) : (
          <div className="grid h-full place-items-center p-8 text-center">
            <div>
              <h1 className="m-0 text-lg">Add a project to start</h1>
              <p className="mt-2 mb-0 text-sm text-muted">
                Open the project menu in the sidebar and add an absolute directory path.
              </p>
            </div>
          </div>
        )}
      </div>
    </Activity>
    {tabs.map(resource => (
      <Activity
        key={resourceKey(resource)}
        mode={active && sameResource(active, resource) ? 'visible' : 'hidden'}
        name={resourceKey(resource)}
      >
        <div className="absolute inset-0 overflow-hidden">
          <ResourceContent
            resource={resource}
            projects={projects}
            focusMode={focusMode}
            onFocusModeChange={onFocusModeChange}
            onOpen={onOpen}
            active={Boolean(active && sameResource(active, resource))}
          />
        </div>
      </Activity>
    ))}
  </main>
)
