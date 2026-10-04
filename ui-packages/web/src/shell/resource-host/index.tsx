import type { Project } from '@herdr-roam/shared'
import { Activity } from 'react'
import { AgentsBoard } from '../../features/agents-board'
import { FileTab } from '../../features/file/file-tab'
import { SessionTab } from '../../features/session/session-tab'
import { SkillTab } from '../../features/skill/skill-tab'
import { WorkbenchHome } from '../../features/workbench/workbench-home'
import { EmptyState } from '../../ui/empty-state'
import {
  type GlobalDimension,
  type ResourceRef,
  resourceKey,
  sameResource,
} from '../../workbench/resource'

const ResourceContent = ({
  resource,
  onOpen,
  active,
}: {
  readonly resource: ResourceRef
  readonly onOpen: (resource: ResourceRef) => void
  readonly active: boolean
}) => {
  if (resource.type === 'session') return <SessionTab resource={resource} active={active} />
  if (resource.type === 'file')
    return <FileTab resource={resource} active={active} onOpen={onOpen} />
  return <SkillTab resource={resource} />
}

export const ResourceHost = ({
  project,
  dimension,
  tabs,
  active,
  onOpen,
}: {
  readonly project: Project | null
  readonly dimension: GlobalDimension
  readonly tabs: readonly ResourceRef[]
  readonly active: ResourceRef | null
  readonly onOpen: (resource: ResourceRef) => void
}) => (
  <main className="relative min-h-0 min-w-0 flex-1 bg-surface">
    <Activity mode={active === null ? 'visible' : 'hidden'} name="workbench">
      <div className="absolute inset-0 overflow-hidden">
        {dimension === 'agents' ? (
          <AgentsBoard />
        ) : project ? (
          <WorkbenchHome project={project} visible={active === null} />
        ) : (
          <EmptyState className="h-full content-center" title="Add a project to start">
            Open the project menu in the sidebar and add an absolute directory path.
          </EmptyState>
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
            onOpen={onOpen}
            active={Boolean(active && sameResource(active, resource))}
          />
        </div>
      </Activity>
    ))}
  </main>
)
