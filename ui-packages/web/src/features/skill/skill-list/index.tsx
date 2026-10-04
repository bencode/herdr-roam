import type { SkillScope, SkillSummary } from '@herdr-roam/shared'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { Badge } from '../../../ui/badge'
import { Button } from '../../../ui/button'
import { EmptyState } from '../../../ui/empty-state'
import {
  listRowClass,
  listRowMetaClass,
  listRowTextClass,
  listRowTitleClass,
} from '../../../ui/list-row'
import { SearchField } from '../../../ui/search-field'
import { SectionHeader } from '../../../ui/section-header'
import type { ResourceRef } from '../../../workbench/resource'
import { sameResource } from '../../../workbench/resource'
import { skillSourceLabel } from '../client'
import { useSkillCatalog } from '../use-skill-catalog'

type SkillResource = Extract<ResourceRef, { type: 'skill' }>

const resourceOf = (skill: SkillSummary): SkillResource =>
  skill.scope === 'project' && skill.projectName
    ? {
        type: 'skill',
        scope: 'project',
        projectName: skill.projectName,
        skillId: skill.id,
      }
    : { type: 'skill', scope: 'user', skillId: skill.id }

const matches = (skill: SkillSummary, query: string): boolean => {
  const normalized = query.trim().toLowerCase()
  return (
    normalized === '' ||
    [skill.name, skill.description, skill.source].some(value =>
      value.toLowerCase().includes(normalized),
    )
  )
}

const SkillGroup = ({
  scope,
  title,
  items,
  query,
  active,
  onOpen,
}: {
  readonly scope: SkillScope
  readonly title: string
  readonly items: readonly SkillSummary[]
  readonly query: string
  readonly active: SkillResource | null
  readonly onOpen: (resource: ResourceRef) => void
}) => (
  <section className="[&+&]:mt-3.5" aria-labelledby={`skills-${scope}`}>
    <SectionHeader id={`skills-${scope}`} title={title} count={items.length} />
    {items.length > 0 ? (
      <div className="grid gap-0.5">
        {items.map(skill => {
          const resource = resourceOf(skill)
          return (
            <button
              type="button"
              key={`${skill.scope}:${skill.id}`}
              className={listRowClass}
              data-active={active && sameResource(active, resource) ? true : undefined}
              onClick={() => onOpen(resource)}
              title={`${skill.location} · ${skillSourceLabel(skill.source)}`}
            >
              <span className={listRowTextClass}>
                <strong className={listRowTitleClass}>{skill.name}</strong>
                {skill.description && (
                  <small className={listRowMetaClass}>{skill.description}</small>
                )}
              </span>
              <Badge>{skillSourceLabel(skill.source)}</Badge>
            </button>
          )
        })}
      </div>
    ) : (
      <p className="m-0 px-2 py-3 text-2xs text-faint">
        {query ? 'No matching Skills' : `No ${scope === 'project' ? 'Project' : 'Personal'} Skills`}
      </p>
    )}
  </section>
)

export const SkillList = ({
  projectName,
  active,
  onOpen,
}: {
  readonly projectName: string
  readonly active: SkillResource | null
  readonly onOpen: (resource: ResourceRef) => void
}) => {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const state = useSkillCatalog(projectName)
  const items = state.value?.items ?? []
  const filtered = useMemo(
    () => items.filter(skill => matches(skill, deferredQuery)),
    [deferredQuery, items],
  )
  const projectSkills = filtered.filter(skill => skill.scope === 'project')
  const personalSkills = filtered.filter(skill => skill.scope === 'user')

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none gap-1.5 px-2.5 py-2">
        <SearchField
          className="flex-1"
          label="Search skills"
          placeholder="Search skills…"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        <Button
          size="defaultIcon"
          onClick={state.reload}
          disabled={state.loading}
          aria-label="Refresh Skills"
          title="Refresh Skills"
        >
          <RefreshCw aria-hidden="true" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-1.75 pb-3.5" aria-busy={state.loading}>
        {state.loading && !state.value ? (
          <p className="m-0 px-4 py-8 text-center text-xs text-muted" role="status">
            Loading Skills…
          </p>
        ) : state.error ? (
          <EmptyState
            title="Skills unavailable"
            role="status"
            action={
              <Button size="compact" variant="secondary" onClick={state.reload}>
                Try again
              </Button>
            }
          >
            {state.error.message}
          </EmptyState>
        ) : (
          <>
            {projectName && (
              <SkillGroup
                scope="project"
                title={`Project · ${projectName}`}
                items={projectSkills}
                query={deferredQuery}
                active={active}
                onOpen={onOpen}
              />
            )}
            <SkillGroup
              scope="user"
              title="Personal"
              items={personalSkills}
              query={deferredQuery}
              active={active}
              onOpen={onOpen}
            />
            {(state.value?.warnings.length ?? 0) > 0 && (
              <details className="mx-2 mt-3.5 border-border border-t pt-2.5 text-2xs text-muted">
                <summary className="flex cursor-pointer items-center gap-1.5">
                  <AlertTriangle className="size-3 flex-none text-warning" aria-hidden="true" />
                  {state.value?.warnings.length} Skills unavailable
                </summary>
                <ul className="m-0 mt-2.5 grid gap-2 pl-4">
                  {state.value?.warnings.map(warning => (
                    <li key={`${warning.source}:${warning.location}`}>
                      <strong className="block">{warning.location}</strong>
                      <span className="block">{warning.message}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  )
}
