import type { ResourceRef } from '../workbench/resource'
import { files, issues, loops, projects } from './project-data'

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
export type FileResource = {
  readonly projectName: string
  readonly path: string
  readonly language: 'markdown' | 'typescript'
  readonly content: string
}
export type SkillResource = {
  readonly id: string
  readonly name: string
  readonly scope: 'user' | 'project'
  readonly projectName?: string
  readonly description: string
  readonly markdown: string
  readonly resources: readonly string[]
}

export { files, issues, loops, projects }

export const skills: readonly SkillResource[] = [
  {
    id: 'herdr-roam-issues',
    name: 'herdr-roam-issues',
    scope: 'user',
    description: 'Read and update structured, Git-backed Issues from agents.',
    markdown: `# herdr-roam-issues

Use deterministic tools to discover, create, and update project Issues without an application database.

## Storage

Each Issue is a Markdown file. YAML Front Matter contains structured fields and the body contains human-readable context.`,
    resources: ['SKILL.md', 'scripts/create-issue.ts', 'references/issue-format.md'],
  },
  {
    id: 'frontend-design',
    name: 'frontend-design',
    scope: 'project',
    projectName: 'herdr-roam',
    description: 'Create intentional product interfaces.',
    markdown: '# frontend-design\n\nDesign interfaces with a clear visual direction.',
    resources: ['SKILL.md'],
  },
]

export const projectByName = (projectName: string): Project | undefined =>
  projects.find(project => project.name === projectName)
export const issueById = (projectName: string, issueId: string): Issue | undefined =>
  issues.find(issue => issue.projectName === projectName && issue.id === issueId)
export const fileByPath = (projectName: string, path: string): FileResource | undefined =>
  files.find(file => file.projectName === projectName && file.path === path)
export const skillById = (skillId: string): SkillResource | undefined =>
  skills.find(skill => skill.id === skillId)

export const resourceTitle = (resource: ResourceRef): string => {
  if (resource.type === 'agent') return resource.agentId
  if (resource.type === 'session') return resource.sessionId
  if (resource.type === 'issue') return resource.issueId.toUpperCase()
  if (resource.type === 'file') return resource.path.split('/').at(-1) ?? resource.path
  return skillById(resource.skillId)?.name ?? resource.skillId
}
