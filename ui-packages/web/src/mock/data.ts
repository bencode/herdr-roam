import { issues, loops, projects } from './project-data'

export type Project = {
  readonly name: string
  readonly path: string
  readonly issuesConfigured: boolean
}
export type Issue = {
  readonly id: string
  readonly title: string
  readonly projectName: string
  readonly status: 'open' | 'closed'
  readonly stage: string
  readonly labels: readonly string[]
  readonly body: string
  readonly sessionId: string
  readonly sessionProvider: 'codex' | 'claude'
  readonly filePath: string
}
export type LoopStatus = 'enabled' | 'paused' | 'error'
export type Loop = {
  readonly id: string
  readonly title: string
  readonly projectName: string
  readonly status: LoopStatus
  readonly schedule: string
  readonly nextRun: string
}
export { issues, loops, projects }

export const projectByName = (projectName: string): Project | undefined =>
  projects.find(project => project.name === projectName)
export const issueById = (projectName: string, issueId: string): Issue | undefined =>
  issues.find(issue => issue.projectName === projectName && issue.id === issueId)
