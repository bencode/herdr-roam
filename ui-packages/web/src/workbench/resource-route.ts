import type { ResourceRef, UtilityRef } from './resource'

export type RouteTarget =
  | { readonly kind: 'root' }
  | { readonly kind: 'projects' }
  | { readonly kind: 'workbench'; readonly projectName: string }
  | { readonly kind: 'resource'; readonly resource: ResourceRef }
  | { readonly kind: 'utility'; readonly utility: UtilityRef }
  | { readonly kind: 'unknown' }

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

export const runtimePath = (): string => '/settings/runtime'

export const resourcePath = (resource: ResourceRef): string => {
  if (resource.type === 'session')
    return `${projectPath(resource.projectName)}/sessions/${encoded(resource.sessionId)}`
  if (resource.type === 'issue')
    return `${projectPath(resource.projectName)}/issues/${encoded(resource.issueId)}`
  if (resource.type === 'file')
    return `${projectPath(resource.projectName)}/files/${encodePath(resource.path)}`
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
  const id = parts[3] ? decode(parts[3]) : null
  if (parts[2] === 'sessions' && id && parts.length === 4)
    return { kind: 'resource', resource: { type: 'session', projectName, sessionId: id } }
  if (parts[2] === 'issues' && id && parts.length === 4)
    return { kind: 'resource', resource: { type: 'issue', projectName, issueId: id } }
  if (parts[2] === 'skills' && id && parts.length === 4)
    return {
      kind: 'resource',
      resource: { type: 'skill', scope: 'project', projectName, skillId: id },
    }
  if (parts[2] !== 'files' || parts.length < 4) return { kind: 'unknown' }
  const decodedParts = parts.slice(3).map(decode)
  if (decodedParts.some(part => part === null)) return { kind: 'unknown' }
  return {
    kind: 'resource',
    resource: { type: 'file', projectName, path: decodedParts.join('/') },
  }
}

const skillTarget = (parts: readonly string[]): RouteTarget | null => {
  if (parts[0] !== 'skills' || parts.length !== 2) return null
  const skillId = decode(parts[1] ?? '')
  return skillId
    ? { kind: 'resource', resource: { type: 'skill', scope: 'user', skillId } }
    : { kind: 'unknown' }
}

export const parseResourcePath = (pathname: string): RouteTarget => {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length === 0) return { kind: 'root' }
  if (parts.length === 2 && parts[0] === 'settings' && parts[1] === 'runtime')
    return { kind: 'utility', utility: 'runtime' }
  return projectTarget(parts) ?? skillTarget(parts) ?? { kind: 'unknown' }
}
