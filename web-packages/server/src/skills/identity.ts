import type { Stats } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import type { SkillApiError, SkillScope, SkillSource } from '@herdr-roam/shared'

export const skillSources = ['agents', 'codex', 'claude'] as const

export type SkillRoot = {
  readonly source: SkillSource
  readonly scope: SkillScope
  readonly projectName?: string
  readonly path: string
  readonly displayPath: string
}

export type SkillIdentity = {
  readonly source: SkillSource
  readonly folderName: string
}

export type SkillErrorCode = SkillApiError['error']['code']

export class SkillError extends Error {
  readonly code: SkillErrorCode

  constructor(code: SkillErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SkillError'
    this.code = code
  }
}

const systemCode = (error: unknown): unknown =>
  typeof error === 'object' && error !== null && 'code' in error ? error.code : null

const validFolderName = (value: string): boolean =>
  value !== '' &&
  value !== '.' &&
  value !== '..' &&
  !value.includes('/') &&
  !value.includes('\\') &&
  !value.includes('\0')

export const skillId = (source: SkillSource, folderName: string): string =>
  `${source}:${folderName}`

export const parseSkillId = (value: string): SkillIdentity => {
  const separator = value.indexOf(':')
  const source = value.slice(0, separator)
  const folderName = value.slice(separator + 1)
  if (!skillSources.some(candidate => candidate === source) || !validFolderName(folderName)) {
    throw new SkillError('invalid_skill', 'A valid source-qualified Skill ID is required.')
  }
  return { source, folderName } as SkillIdentity
}

export const personalRoots = (roots: Readonly<Record<SkillSource, string>>): readonly SkillRoot[] =>
  skillSources.map(source => ({
    source,
    scope: 'user',
    path: roots[source],
    displayPath: `~/.${source}/skills`,
  }))

export const projectRoots = (projectName: string, projectPath: string): readonly SkillRoot[] =>
  skillSources.map(source => ({
    source,
    scope: 'project',
    projectName,
    path: join(projectPath, `.${source}`, 'skills'),
    displayPath: `.${source}/skills`,
  }))

export const rootForIdentity = (
  roots: readonly SkillRoot[],
  identity: SkillIdentity,
): SkillRoot => {
  const root = roots.find(candidate => candidate.source === identity.source)
  if (!root) throw new SkillError('skill_not_found', 'Skill source was not found.')
  return root
}

export const resolveSkillDirectory = async (
  root: SkillRoot,
  folderName: string,
): Promise<string> => {
  if (!validFolderName(folderName)) throw new SkillError('invalid_skill', 'Skill name is invalid.')
  try {
    const directory = await realpath(join(root.path, folderName))
    if (!(await stat(directory)).isDirectory()) {
      throw new SkillError('skill_not_found', 'Skill directory was not found.')
    }
    return directory
  } catch (error) {
    if (error instanceof SkillError) throw error
    const code = systemCode(error)
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      throw new SkillError('skill_not_found', 'Skill directory was not found.', { cause: error })
    }
    throw new SkillError('skill_unavailable', 'Skill directory could not be resolved.', {
      cause: error,
    })
  }
}

const insideRoot = (root: string, candidate: string): boolean => {
  const child = relative(root, candidate)
  return child === '' || (!isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`))
}

export const normalizeSkillPath = (value: string, allowRoot = false): string => {
  if (value === '' && allowRoot) return ''
  if (
    value === '' ||
    value.includes('\0') ||
    value.includes('\\') ||
    value.startsWith('/') ||
    /^[a-zA-Z]:/.test(value)
  ) {
    throw new SkillError('invalid_path', 'A Skill-relative file path is required.')
  }
  const parts = value.split('/')
  if (parts.some(part => part === '' || part === '.' || part === '..')) {
    throw new SkillError('invalid_path', 'The Skill file path is invalid.')
  }
  return parts.join('/')
}

export const resolveSkillEntry = async (
  root: string,
  requestedPath: string,
): Promise<{ readonly path: string; readonly stats: Stats }> => {
  const relativePath = normalizeSkillPath(requestedPath)
  let canonicalRoot: string
  try {
    canonicalRoot = await realpath(root)
  } catch (error) {
    throw new SkillError('skill_unavailable', 'Skill directory could not be resolved.', {
      cause: error,
    })
  }
  const unresolved = resolve(canonicalRoot, ...relativePath.split('/'))
  let canonical: string
  try {
    canonical = await realpath(unresolved)
  } catch (error) {
    const code = systemCode(error)
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      throw new SkillError('file_not_found', `File ${relativePath} was not found.`, {
        cause: error,
      })
    }
    throw new SkillError('file_unavailable', `File ${relativePath} could not be resolved.`, {
      cause: error,
    })
  }
  if (!insideRoot(canonicalRoot, canonical)) {
    throw new SkillError('invalid_path', 'The requested path leaves the Skill directory.')
  }
  try {
    return { path: canonical, stats: await stat(canonical) }
  } catch (error) {
    throw new SkillError('file_unavailable', `File ${relativePath} could not be inspected.`, {
      cause: error,
    })
  }
}
