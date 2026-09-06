import type {
  IssueCatalog,
  IssueCatalogWarning,
  IssueDetail,
  IssuePriority,
  IssueStatus,
  IssueSummary,
  IssueType,
} from '@herdr-roam/shared'
import { parseDocument } from 'yaml'
import { IssueError, listIssueNames, readIssueSource, resolveIssueStore } from './storage.js'

const statuses: readonly IssueStatus[] = ['open', 'closed']
const types: readonly IssueType[] = ['task', 'bug', 'feature']
const priorities: readonly IssuePriority[] = ['p0', 'p1', 'p2', 'p3']

const recordOf = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const oneOf = <Value extends string>(value: unknown, values: readonly Value[]): value is Value =>
  typeof value === 'string' && values.some(candidate => candidate === value)

const parseIssue = (id: string, path: string, text: string): IssueDetail => {
  const front = /^---\r?\n([\s\S]*?)^---(?:\r?\n|$)/m.exec(text)
  if (front?.index !== 0) {
    throw new IssueError('invalid_issue', 'Issue must start with terminated YAML front matter.')
  }
  const document = parseDocument(front[1] ?? '')
  const diagnostics = [...document.errors, ...document.warnings]
  if (diagnostics.length > 0) {
    throw new IssueError('invalid_issue', diagnostics.map(value => value.message).join('\n'))
  }
  const metadata = recordOf(document.toJS())
  if (!metadata) throw new IssueError('invalid_issue', 'Issue metadata must be an object.')
  if (metadata.id !== id) throw new IssueError('invalid_issue', 'Issue id must match its filename.')
  if (typeof metadata.title !== 'string' || metadata.title.trim() === '') {
    throw new IssueError('invalid_issue', 'Issue title must be a nonempty string.')
  }
  if (!oneOf(metadata.status, statuses)) {
    throw new IssueError('invalid_issue', 'Issue status must be open or closed.')
  }
  if (metadata.type !== undefined && !oneOf(metadata.type, types)) {
    throw new IssueError('invalid_issue', 'Issue type is invalid.')
  }
  if (metadata.priority !== undefined && !oneOf(metadata.priority, priorities)) {
    throw new IssueError('invalid_issue', 'Issue priority is invalid.')
  }
  if (
    metadata.labels !== undefined &&
    (!Array.isArray(metadata.labels) || !metadata.labels.every(label => typeof label === 'string'))
  ) {
    throw new IssueError('invalid_issue', 'Issue labels must be an array of strings.')
  }
  return {
    id,
    title: metadata.title.trim(),
    status: metadata.status,
    ...(metadata.type === undefined ? {} : { type: metadata.type }),
    ...(metadata.priority === undefined ? {} : { priority: metadata.priority }),
    labels: metadata.labels ?? [],
    path,
    body: text.slice(front[0].length),
  }
}

const summaryOf = ({ body: _body, ...summary }: IssueDetail): IssueSummary => summary

const rank = (issue: IssueSummary): number =>
  issue.priority === undefined ? priorities.length : priorities.indexOf(issue.priority)

const compareIssues = (left: IssueSummary, right: IssueSummary): number =>
  rank(left) - rank(right) || left.id.localeCompare(right.id)

const warningOf = (path: string, error: unknown): IssueCatalogWarning => ({
  path,
  code:
    error instanceof IssueError && error.code === 'invalid_issue'
      ? 'invalid_issue'
      : 'issue_unavailable',
  message: error instanceof Error ? error.message : 'Issue could not be read.',
})

export const listIssues = async (workspacePath: string): Promise<IssueCatalog> => {
  const store = await resolveIssueStore(workspacePath)
  const items: IssueSummary[] = []
  const warnings: IssueCatalogWarning[] = []
  for (const name of await listIssueNames(store)) {
    const id = name.slice(0, -3)
    const path = `${store.relativeDirectory}/${name}`
    try {
      const source = await readIssueSource(store, id)
      items.push(summaryOf(parseIssue(id, source.path, source.text)))
    } catch (error) {
      warnings.push(warningOf(path, error))
    }
  }
  return { items: items.toSorted(compareIssues), warnings }
}

export const readIssue = async (workspacePath: string, id: string): Promise<IssueDetail> => {
  const store = await resolveIssueStore(workspacePath)
  const source = await readIssueSource(store, id)
  return parseIssue(id, source.path, source.text)
}
