import type { SkillScope, SkillSummary } from '@herdr-roam/shared'
import { AlertTriangle, RefreshCw, Search } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import type { ResourceRef } from '../../../workbench/resource'
import { sameResource } from '../../../workbench/resource'
import { skillSourceLabel } from '../client'
import { useSkillCatalog } from '../use-skill-catalog'
import styles from './style.module.scss'

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
  <section className={styles.group} aria-labelledby={`skills-${scope}`}>
    <header>
      <h2 id={`skills-${scope}`}>{title}</h2>
      <span>{items.length}</span>
    </header>
    {items.length > 0 ? (
      <div className={styles.rows}>
        {items.map(skill => {
          const resource = resourceOf(skill)
          return (
            <button
              type="button"
              key={`${skill.scope}:${skill.id}`}
              className={styles.row}
              data-active={active && sameResource(active, resource) ? true : undefined}
              onClick={() => onOpen(resource)}
              title={`${skill.location} · ${skillSourceLabel(skill.source)}`}
            >
              <span className={styles.rowText}>
                <strong>{skill.name}</strong>
                {skill.description && <small>{skill.description}</small>}
              </span>
              <span className={styles.source}>{skillSourceLabel(skill.source)}</span>
            </button>
          )
        })}
      </div>
    ) : (
      <p className={styles.groupEmpty}>
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
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search aria-hidden="true" />
          <span className="sr-only">Search skills</span>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search skills…"
          />
        </label>
        <button
          type="button"
          className={styles.refresh}
          onClick={state.reload}
          disabled={state.loading}
          aria-label="Refresh Skills"
          title="Refresh Skills"
        >
          <RefreshCw aria-hidden="true" />
        </button>
      </div>

      <div className={styles.catalog} aria-busy={state.loading}>
        {state.loading && !state.value ? (
          <p className={styles.status}>Loading Skills…</p>
        ) : state.error ? (
          <div className={styles.error} role="status">
            <strong>Skills unavailable</strong>
            <span>{state.error.message}</span>
            <button type="button" onClick={state.reload}>
              Try again
            </button>
          </div>
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
              <details className={styles.warnings}>
                <summary>
                  <AlertTriangle aria-hidden="true" />
                  {state.value?.warnings.length} Skills unavailable
                </summary>
                <ul>
                  {state.value?.warnings.map(warning => (
                    <li key={`${warning.source}:${warning.location}`}>
                      <strong>{warning.location}</strong>
                      <span>{warning.message}</span>
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
