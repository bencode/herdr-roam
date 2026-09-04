import { execFile } from 'node:child_process'
import { realpath, stat } from 'node:fs/promises'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export type GitLocation = {
  readonly topLevel: string
  readonly commonDirectory: string
}

export type GitWorktree = {
  readonly path: string
  readonly branch: string | null
}

export class GitInspectionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'GitInspectionError'
  }
}

const errorCode = (error: unknown): unknown =>
  typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined

export const existingDirectory = async (path: string): Promise<string | null> => {
  try {
    const canonical = await realpath(path)
    return (await stat(canonical)).isDirectory() ? canonical : null
  } catch (error) {
    const code = errorCode(error)
    if (code !== 'ENOENT' && code !== 'ENOTDIR') {
      console.error(`Directory ${path} could not be inspected`, error)
    }
    return null
  }
}

export const gitLocation = async (cwd: string): Promise<GitLocation | null> => {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', cwd, 'rev-parse', '--path-format=absolute', '--show-toplevel', '--git-common-dir'],
      { encoding: 'utf8', timeout: 5_000 },
    )
    const [topLevel, commonDirectory, ...extra] = stdout.trim().split('\n')
    if (!topLevel || !commonDirectory || extra.length > 0) {
      throw new Error('Git returned an invalid repository location.')
    }
    const [canonicalTopLevel, canonicalCommonDirectory] = await Promise.all([
      realpath(topLevel),
      realpath(commonDirectory),
    ])
    return { topLevel: canonicalTopLevel, commonDirectory: canonicalCommonDirectory }
  } catch (error) {
    if (typeof errorCode(error) !== 'number') {
      console.error(`Git repository inspection failed for ${cwd}`, error)
    }
    return null
  }
}

const parseWorktreeRecord = (fields: readonly string[]): GitWorktree | null => {
  const path = fields.find(field => field.startsWith('worktree '))?.slice('worktree '.length)
  if (!path) return null
  const branch = fields.find(field => field.startsWith('branch '))?.slice('branch '.length) ?? null
  return {
    path,
    branch: branch?.startsWith('refs/heads/') ? branch.slice('refs/heads/'.length) : branch,
  }
}

const parseWorktrees = (stdout: string): readonly GitWorktree[] =>
  stdout
    .split('\0\0')
    .map(record => parseWorktreeRecord(record.split('\0').filter(Boolean)))
    .filter((worktree): worktree is GitWorktree => worktree !== null)

export const gitWorktrees = async (cwd: string): Promise<readonly GitWorktree[] | null> => {
  if (!(await gitLocation(cwd))) return null
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['-C', cwd, 'worktree', 'list', '--porcelain', '-z'],
      {
        encoding: 'utf8',
        timeout: 5_000,
        maxBuffer: 4 * 1024 * 1024,
      },
    )
    return parseWorktrees(stdout)
  } catch (error) {
    throw new GitInspectionError(`Git worktrees could not be listed for ${cwd}.`, { cause: error })
  }
}
