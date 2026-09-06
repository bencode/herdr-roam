import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import { z } from 'zod'

const CONFIG_MAX_BYTES = 64 * 1024
export const ISSUE_MAX_BYTES = 1024 * 1024
const ISSUE_CATALOG_MAX_FILES = 1000
const issueId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const configSchema = z
  .object({
    version: z.literal(1),
    issues: z.object({ directory: z.string().trim().min(1) }).passthrough(),
  })
  .passthrough()

export type IssueErrorCode =
  | 'issue_store_not_configured'
  | 'invalid_issue_config'
  | 'issue_store_unavailable'
  | 'invalid_issue'
  | 'issue_not_found'
  | 'issue_unavailable'
  | 'issue_catalog_too_large'
  | 'project_not_found'

export class IssueError extends Error {
  readonly code: IssueErrorCode

  constructor(code: IssueErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'IssueError'
    this.code = code
  }
}

export type IssueStore = {
  readonly root: string
  readonly directory: string
  readonly relativeDirectory: string
}

const systemCode = (error: unknown): unknown =>
  typeof error === 'object' && error !== null && 'code' in error ? error.code : null

const contained = (root: string, target: string): boolean => {
  const local = relative(root, target)
  return local === '' || (!isAbsolute(local) && local !== '..' && !local.startsWith(`..${sep}`))
}

const validLocalPath = (value: string): readonly string[] | null => {
  if (isAbsolute(value) || value.includes('\\') || value.includes('\0')) return null
  const parts = value.split('/').filter(part => part !== '' && part !== '.')
  if (parts.length === 0 || parts.some(part => part === '..' || part.toLowerCase() === '.git')) {
    return null
  }
  return parts
}

const existingEntry = async (
  root: string,
  localPath: string,
  code: IssueErrorCode,
  message: string,
): Promise<string> => {
  const parts = validLocalPath(localPath)
  if (!parts) throw new IssueError(code, message)
  let target = root
  try {
    for (const part of parts) {
      target = await realpath(join(target, part))
      if (!contained(root, target)) throw new IssueError(code, message)
    }
    return target
  } catch (error) {
    if (error instanceof IssueError) throw error
    throw new IssueError(code, message, { cause: error })
  }
}

const boundedText = async (
  path: string,
  limit: number,
  code: IssueErrorCode,
  message: string,
): Promise<string> => {
  try {
    const stats = await lstat(path)
    if (!stats.isFile()) throw new IssueError(code, message)
    if (stats.size > limit) throw new IssueError(code, message)
    return await readFile(path, 'utf8')
  } catch (error) {
    if (error instanceof IssueError) throw error
    throw new IssueError(code, message, { cause: error })
  }
}

export const resolveIssueStore = async (workspacePath: string): Promise<IssueStore> => {
  const root = await realpath(resolve(workspacePath))
  let configPath: string
  try {
    configPath = await existingEntry(
      root,
      '.herdr-roam.json',
      'invalid_issue_config',
      '.herdr-roam.json is unavailable or unsafe.',
    )
  } catch (error) {
    if (error instanceof IssueError && systemCode(error.cause) === 'ENOENT') {
      throw new IssueError(
        'issue_store_not_configured',
        'This Workspace does not configure an Issue store.',
        { cause: error },
      )
    }
    throw error
  }
  let content: string
  content = await boundedText(
    configPath,
    CONFIG_MAX_BYTES,
    'invalid_issue_config',
    '.herdr-roam.json is invalid or exceeds 64 KiB.',
  )
  let raw: unknown
  try {
    raw = JSON.parse(content)
  } catch (error) {
    throw new IssueError('invalid_issue_config', '.herdr-roam.json is not valid JSON.', {
      cause: error,
    })
  }
  const parsed = configSchema.safeParse(raw)
  if (!parsed.success) {
    throw new IssueError(
      'invalid_issue_config',
      '.herdr-roam.json must contain version 1 and issues.directory.',
      { cause: parsed.error },
    )
  }
  const relativeDirectory = parsed.data.issues.directory
  const directory = await existingEntry(
    root,
    relativeDirectory,
    'issue_store_unavailable',
    'The configured Issue directory is unavailable or unsafe.',
  )
  try {
    if (!(await lstat(directory)).isDirectory()) {
      throw new IssueError(
        'issue_store_unavailable',
        'The configured Issue path is not a directory.',
      )
    }
  } catch (error) {
    if (error instanceof IssueError) throw error
    throw new IssueError(
      'issue_store_unavailable',
      'The configured Issue directory is unavailable.',
      {
        cause: error,
      },
    )
  }
  return { root, directory, relativeDirectory }
}

export const listIssueNames = async (store: IssueStore): Promise<readonly string[]> => {
  let names: readonly string[]
  try {
    names = (await readdir(store.directory, { withFileTypes: true }))
      .filter(entry => entry.name.endsWith('.md'))
      .map(entry => entry.name)
      .toSorted()
  } catch (error) {
    throw new IssueError('issue_store_unavailable', 'The Issue directory could not be read.', {
      cause: error,
    })
  }
  if (names.length > ISSUE_CATALOG_MAX_FILES) {
    throw new IssueError(
      'issue_catalog_too_large',
      `The Issue directory contains more than ${ISSUE_CATALOG_MAX_FILES} Markdown files.`,
    )
  }
  return names
}

export const readIssueSource = async (
  store: IssueStore,
  id: string,
): Promise<{ readonly path: string; readonly text: string }> => {
  if (!issueId.test(id)) throw new IssueError('invalid_issue', 'Issue id must be a UUID.')
  const localPath = `${store.relativeDirectory}/${id}.md`
  let path: string
  try {
    path = await existingEntry(
      store.root,
      localPath,
      'issue_unavailable',
      'The Issue file is unavailable or unsafe.',
    )
  } catch (error) {
    if (error instanceof IssueError && systemCode(error.cause) === 'ENOENT') {
      throw new IssueError('issue_not_found', 'Issue not found.', { cause: error })
    }
    throw error
  }
  return {
    path: localPath,
    text: await boundedText(
      path,
      ISSUE_MAX_BYTES,
      'issue_unavailable',
      'The Issue file is unavailable or exceeds 1 MiB.',
    ),
  }
}
