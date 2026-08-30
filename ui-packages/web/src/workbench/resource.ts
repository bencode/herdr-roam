export type GlobalDimension = 'projects' | 'agents' | 'skills'
export type ProjectSection = 'sessions' | 'issues' | 'loops' | 'files'
export type UtilityRef = 'runtime'

export type ResourceRef =
  | { readonly type: 'agent'; readonly agentId: string }
  | { readonly type: 'session'; readonly projectName: string; readonly sessionId: string }
  | { readonly type: 'issue'; readonly projectName: string; readonly issueId: string }
  | { readonly type: 'file'; readonly projectName: string; readonly path: string }
  | { readonly type: 'skill'; readonly scope: 'user'; readonly skillId: string }
  | {
      readonly type: 'skill'
      readonly scope: 'project'
      readonly projectName: string
      readonly skillId: string
    }

const recordOf = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null

const stringField = (record: Record<string, unknown>, field: string): string | null =>
  typeof record[field] === 'string' && record[field] !== '' ? record[field] : null

export const isResourceRef = (value: unknown): value is ResourceRef => {
  const record = recordOf(value)
  if (!record) return false
  const type = stringField(record, 'type')
  if (type === 'agent') return Boolean(stringField(record, 'agentId'))
  if (type === 'session')
    return Boolean(stringField(record, 'projectName') && stringField(record, 'sessionId'))
  if (type === 'issue')
    return Boolean(stringField(record, 'projectName') && stringField(record, 'issueId'))
  if (type === 'file')
    return Boolean(stringField(record, 'projectName') && stringField(record, 'path'))
  if (type !== 'skill') return false
  const scope = stringField(record, 'scope')
  const validScope = scope === 'user' || scope === 'project'
  const validProject = scope !== 'project' || Boolean(stringField(record, 'projectName'))
  return validScope && validProject && Boolean(stringField(record, 'skillId'))
}

export const resourceKey = (resource: ResourceRef): string => {
  if (resource.type === 'agent') return `agent:${resource.agentId}`
  if (resource.type === 'session') return `session:${resource.projectName}:${resource.sessionId}`
  if (resource.type === 'issue') return `issue:${resource.projectName}:${resource.issueId}`
  if (resource.type === 'file') return `file:${resource.projectName}:${resource.path}`
  const owner = resource.scope === 'project' ? resource.projectName : 'user'
  return `skill:${resource.scope}:${owner}:${resource.skillId}`
}

export const sameResource = (left: ResourceRef, right: ResourceRef): boolean =>
  resourceKey(left) === resourceKey(right)
