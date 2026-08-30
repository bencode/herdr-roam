import { Search } from 'lucide-react'
import { Activity, useState } from 'react'
import { AgentList } from '../../features/agent/agent-list'
import type { SkillResource } from '../../mock/data'
import { skills } from '../../mock/data'
import type { GlobalDimension, ProjectSection, ResourceRef } from '../../workbench/resource'
import { ProjectPanel } from './project-panel'

type Props = {
  readonly dimension: GlobalDimension
  readonly activeProjectName: string
  readonly activeAgentId: string | null
  readonly projectSection: ProjectSection
  readonly onProjectSection: (section: ProjectSection) => void
  readonly onOpen: (resource: ResourceRef) => void
}

const skillResource = (skill: SkillResource): Extract<ResourceRef, { type: 'skill' }> =>
  skill.scope === 'project' && skill.projectName
    ? { type: 'skill', scope: 'project', projectName: skill.projectName, skillId: skill.id }
    : { type: 'skill', scope: 'user', skillId: skill.id }

const matches = (query: string, ...values: readonly string[]): boolean =>
  values.some(value => value.toLowerCase().includes(query.trim().toLowerCase()))

const SkillList = ({ onOpen, query }: Pick<Props, 'onOpen'> & { readonly query: string }) => (
  <div className="min-h-0 flex-1 overflow-auto px-1.75 pb-3.5">
    {skills
      .filter(skill => matches(query, skill.name, skill.description))
      .map(skill => (
        <button
          type="button"
          key={skill.id}
          className="flex w-full items-start gap-2.5 rounded-sm border-0 bg-transparent px-2 py-2.5 text-left hover:bg-hover [&>span]:grid [&>span]:min-w-0 [&>span]:gap-0.75 [&_small]:truncate [&_small]:text-[0.625rem] [&_small]:text-faint [&_strong]:truncate [&_strong]:text-xs [&_strong]:font-semibold"
          onClick={() => onOpen(skillResource(skill))}
        >
          <span>
            <strong>{skill.name}</strong>
            <small>{skill.scope} Skill</small>
          </span>
        </button>
      ))}
  </div>
)

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
              section={props.projectSection}
              onSection={props.onProjectSection}
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
        <SkillPanel onOpen={props.onOpen} />
      </Activity>
    </div>
  )
}

const SkillPanel = ({ onOpen }: Pick<Props, 'onOpen'>) => {
  const [query, setQuery] = useState('')
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <label className="mx-2.5 mt-3 mb-2 flex h-8 flex-none items-center gap-2 rounded-md border border-border bg-surface px-2 transition-[border-color,box-shadow] duration-150 focus-within:border-primary focus-within:shadow-[0_0_0_1px_var(--primary)] [&>svg]:w-3.5 [&>svg]:text-faint">
        <Search aria-hidden="true" />
        <span className="sr-only">Search skills</span>
        <input
          className="min-w-0 flex-1 border-0 bg-transparent text-xs outline-none! placeholder:text-faint"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search skills…"
        />
      </label>
      <SkillList onOpen={onOpen} query={query} />
    </div>
  )
}
