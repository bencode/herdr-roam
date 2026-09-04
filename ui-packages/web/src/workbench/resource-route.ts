import type { GlobalDimension, ProjectSection, ResourceRef } from './resource'

export type RouteTarget =
  | { readonly kind: 'root' }
  | { readonly kind: 'projects' }
  | { readonly kind: 'workbench'; readonly projectName: string }
  | {
      readonly kind: 'project-section'
      readonly projectName: string
      readonly section: ProjectSection
    }
  | { readonly kind: 'agent-list' }
  | { readonly kind: 'skill-list' }
  | { readonly kind: 'resource'; readonly resource: ResourceRef }
  | { readonly kind: 'unknown' }

const projectSections: readonly ProjectSection[] = ['sessions', 'issues', 'loops', 'files']

const isProjectSection = (value: string | undefined): value is ProjectSection =>
  projectSections.some(section => section === value)

const decode = (value: string): string | null => {
  try {
    return decodeURIComponent(value)
  } catch (error) {
    console.error('resource route decode failed', error)
    return null
  }
}

const encoded = (value: string): string => encodeURIComponent(value)
const encodePath = (path: string): string => path.split('/').map(encoded).join('/')

export const projectPath = (projectName: string): string => `/projects/${encoded(projectName)}`

export const projectSectionPath = (projectName: string, section: ProjectSection): string =>
  `${projectPath(projectName)}/${section}`

export const activityRootPath = (dimension: GlobalDimension, projectName: string): string => {
  if (dimension === 'projects') return projectPath(projectName)
  return `/${dimension}`
}

export const resourcePath = (resource: ResourceRef): string => {
  if (resource.type === 'agent') return `/agents/${encoded(resource.agentId)}`
  if (resource.type === 'session')
    return `${projectSectionPath(resource.projectName, 'sessions')}/${encoded(resource.provider)}/${encoded(resource.sessionId)}`
  if (resource.type === 'issue')
    return `${projectSectionPath(resource.projectName, 'issues')}/${encoded(resource.issueId)}`
  if (resource.type === 'file')
    return `${projectSectionPath(resource.projectName, 'files')}/${encoded(resource.workspaceId)}/${encodePath(resource.path)}`
  if (resource.scope === 'project')
    return `${projectPath(resource.projectName)}/skills/${encoded(resource.skillId)}`
  return `/skills/${encoded(resource.skillId)}`
}

const projectTarget = (parts: readonly string[]): RouteTarget | null => {
  if (parts[0] !== 'projects') return null
  if (parts.length === 1) return { kind: 'projects' }
  const projectName = decode(parts[1] ?? '')
  if (!projectName) return { kind: 'unknown' }
  if (parts.length === 2) return { kind: 'workbench', projectName }
  const section = parts[2]
  if (isProjectSection(section) && parts.length === 3)
    return { kind: 'project-section', projectName, section }
  const id = parts[3] ? decode(parts[3]) : null
  const sessionId = parts[4] ? decode(parts[4]) : null
  if (
    section === 'sessions' &&
    (id === 'codex' || id === 'claude') &&
    sessionId &&
    parts.length === 5
  ) {
    return {
      kind: 'resource',
      resource: { type: 'session', projectName, provider: id, sessionId },
    }
  }
  if (section === 'issues' && id && parts.length === 4)
    return { kind: 'resource', resource: { type: 'issue', projectName, issueId: id } }
  if (section === 'skills' && id && parts.length === 4)
    return {
      kind: 'resource',
      resource: { type: 'skill', scope: 'project', projectName, skillId: id },
    }
  if (section !== 'files' || parts.length < 5 || !id) return { kind: 'unknown' }
  const decodedParts = parts.slice(4).map(decode)
  if (decodedParts.some(part => part === null)) return { kind: 'unknown' }
  return {
    kind: 'resource',
    resource: { type: 'file', projectName, workspaceId: id, path: decodedParts.join('/') },
  }
}

const skillTarget = (parts: readonly string[]): RouteTarget | null => {
  if (parts[0] !== 'skills') return null
  if (parts.length === 1) return { kind: 'skill-list' }
  if (parts.length !== 2) return { kind: 'unknown' }
  const skillId = decode(parts[1] ?? '')
  return skillId
    ? { kind: 'resource', resource: { type: 'skill', scope: 'user', skillId } }
    : { kind: 'unknown' }
}

const agentTarget = (parts: readonly string[]): RouteTarget | null => {
  if (parts[0] !== 'agents') return null
  if (parts.length === 1) return { kind: 'agent-list' }
  if (parts.length !== 2) return { kind: 'unknown' }
  const agentId = decode(parts[1] ?? '')
  return agentId ? { kind: 'resource', resource: { type: 'agent', agentId } } : { kind: 'unknown' }
}

export const parseResourcePath = (pathname: string): RouteTarget => {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return { kind: 'root' }
  return projectTarget(parts) ?? agentTarget(parts) ?? skillTarget(parts) ?? { kind: 'unknown' }
}

export const routeDimension = (target: RouteTarget): GlobalDimension | null => {
  if (target.kind === 'agent-list') return 'agents'
  if (target.kind === 'skill-list') return 'skills'
  if (target.kind === 'workbench' || target.kind === 'project-section') return 'projects'
  if (target.kind !== 'resource') return null
  if (target.resource.type === 'agent') return 'agents'
  if (target.resource.type === 'skill') return 'skills'
  return 'projects'
}

export const routeProjectSection = (target: RouteTarget): ProjectSection | null => {
  if (target.kind === 'workbench') return 'sessions'
  if (target.kind === 'project-section') return target.section
  if (target.kind !== 'resource') return null
  if (target.resource.type === 'session') return 'sessions'
  if (target.resource.type === 'issue') return 'issues'
  if (target.resource.type === 'file') return 'files'
  return null
}

export const canonicalPath = (target: RouteTarget): string | null => {
  if (target.kind === 'root') return '/'
  if (target.kind === 'projects') return '/projects'
  if (target.kind === 'workbench') return projectPath(target.projectName)
  if (target.kind === 'project-section')
    return projectSectionPath(target.projectName, target.section)
  if (target.kind === 'agent-list') return '/agents'
  if (target.kind === 'skill-list') return '/skills'
  if (target.kind === 'resource') return resourcePath(target.resource)
  return null
}
