import { Search } from 'lucide-react'
import { Activity, useState } from 'react'
import { cn } from '../../lib/cn'
import type { AgentStatus, SkillResource } from '../../mock/data'
import { agents, skills } from '../../mock/data'
import type { GlobalDimension, ResourceRef } from '../../workbench/resource'
import { ProjectPanel } from './project-panel'

const statusClasses: Readonly<Record<AgentStatus, string>> = {
  working: 'bg-primary',
  blocked: 'bg-warning',
  idle: 'bg-primary',
  done: 'bg-success',
}

type Props = {
  readonly dimension: GlobalDimension
  readonly activeProjectName: string
  readonly onOpen: (resource: ResourceRef) => void
}

const Status = ({ value }: { readonly value: AgentStatus }) => (
  <i
    className={cn('size-1.5 flex-none rounded-full', statusClasses[value])}
    role="img"
    aria-label={value}
  />
)

const skillResource = (skill: SkillResource): Extract<ResourceRef, { type: 'skill' }> =>
  skill.scope === 'project' && skill.projectName
    ? { type: 'skill', scope: 'project', projectName: skill.projectName, skillId: skill.id }
    : { type: 'skill', scope: 'user', skillId: skill.id }

const matches = (query: string, ...values: readonly string[]): boolean =>
  values.some(value => value.toLowerCase().includes(query.trim().toLowerCase()))

const AgentList = ({ onOpen, query }: Pick<Props, 'onOpen'> & { readonly query: string }) => (
  <div className="min-h-0 flex-1 overflow-auto px-1.75 pb-3.5">
    {agents
      .filter(agent => matches(query, agent.name, agent.projectName, agent.provider))
      .map(agent => (
        <button
          type="button"
          key={agent.id}
          className="flex w-full items-start gap-2.5 rounded-sm border-0 bg-transparent px-2 py-2.5 text-left hover:bg-hover [&>i]:mt-[0.3rem] [&>span]:grid [&>span]:min-w-0 [&>span]:gap-0.75 [&_small]:truncate [&_small]:text-[0.625rem] [&_small]:text-faint [&_strong]:truncate [&_strong]:text-xs [&_strong]:font-semibold"
          onClick={() =>
            onOpen({
              type: 'session',
              projectName: agent.projectName,
              sessionId: agent.sessionId,
            })
          }
        >
          <Status value={agent.status} />
          <span>
            <strong>{agent.name}</strong>
            <small>
              {agent.projectName} · {agent.provider}
            </small>
          </span>
        </button>
      ))}
  </div>
)

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
          <ProjectPanel
            key={props.activeProjectName}
            activeProjectName={props.activeProjectName}
            onOpen={props.onOpen}
          />
        </div>
      </Activity>
      <Activity name="agents-sidebar" mode={props.dimension === 'agents' ? 'visible' : 'hidden'}>
        <SearchablePanel dimension="agents" onOpen={props.onOpen} />
      </Activity>
      <Activity name="skills-sidebar" mode={props.dimension === 'skills' ? 'visible' : 'hidden'}>
        <SearchablePanel dimension="skills" onOpen={props.onOpen} />
      </Activity>
    </div>
  )
}

const SearchablePanel = ({
  dimension,
  onOpen,
}: Pick<Props, 'onOpen'> & { readonly dimension: Exclude<GlobalDimension, 'projects'> }) => {
  const [query, setQuery] = useState('')
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <label className="mx-2.5 mt-3 mb-2 flex h-8 flex-none items-center gap-2 rounded-md border border-border bg-surface px-2 transition-[border-color,box-shadow] duration-150 focus-within:border-primary focus-within:shadow-[0_0_0_1px_var(--primary)] [&>svg]:w-3.5 [&>svg]:text-faint">
        <Search aria-hidden="true" />
        <span className="sr-only">Search {dimension}</span>
        <input
          className="min-w-0 flex-1 border-0 bg-transparent text-xs outline-none! placeholder:text-faint"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={`Search ${dimension}…`}
        />
      </label>
      {dimension === 'agents' ? (
        <AgentList onOpen={onOpen} query={query} />
      ) : (
        <SkillList onOpen={onOpen} query={query} />
      )}
    </div>
  )
}
