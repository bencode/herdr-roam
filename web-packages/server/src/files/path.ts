import type { Stats } from 'node:fs'
import { realpath, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import type { ProjectFileApiError } from '@herdr-roam/shared'

export type ProjectFileErrorCode = ProjectFileApiError['error']['code']

export class ProjectFileError extends Error {
  readonly code: ProjectFileErrorCode

  constructor(code: ProjectFileErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ProjectFileError'
    this.code = code
  }
}

const errorCode = (error: unknown): unknown =>
  typeof error === 'object' && error !== null && 'code' in error ? error.code : null

export const normalizeProjectPath = (value: string, allowRoot = false): string => {
  if (value === '' && allowRoot) return ''
  if (
    value === '' ||
    value.includes('\0') ||
    value.includes('\\') ||
    value.startsWith('/') ||
    /^[a-zA-Z]:/.test(value)
  ) {
    throw new ProjectFileError('invalid_path', 'A Project-relative file path is required.')
  }
  const parts = value.split('/')
  if (parts.some(part => part === '' || part === '.' || part === '..')) {
    throw new ProjectFileError('invalid_path', 'The file path is invalid.')
  }
  return parts.join('/')
}

export const canonicalProjectRoot = async (path: string): Promise<string> => {
  try {
    const root = await realpath(path)
    if (!(await stat(root)).isDirectory()) {
      throw new ProjectFileError(
        'project_directory_unavailable',
        `Project directory ${path} is unavailable.`,
      )
    }
    return root
  } catch (error) {
    if (error instanceof ProjectFileError) throw error
    throw new ProjectFileError(
      'project_directory_unavailable',
      `Project directory ${path} is unavailable.`,
      { cause: error },
    )
  }
}

const insideRoot = (root: string, candidate: string): boolean => {
  const child = relative(root, candidate)
  return child === '' || (!isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`))
}

export const resolveProjectEntry = async (
  root: string,
  relativePath: string,
): Promise<{ readonly path: string; readonly stats: Stats }> => {
  const normalized = normalizeProjectPath(relativePath)
  const unresolved = resolve(root, ...normalized.split('/'))
  let canonical: string
  try {
    canonical = await realpath(unresolved)
  } catch (error) {
    if (errorCode(error) === 'ENOENT' || errorCode(error) === 'ENOTDIR') {
      throw new ProjectFileError('file_not_found', `File ${normalized} was not found.`, {
        cause: error,
      })
    }
    throw new ProjectFileError('file_unavailable', `File ${normalized} could not be resolved.`, {
      cause: error,
    })
  }
  if (!insideRoot(root, canonical)) {
    throw new ProjectFileError('invalid_path', 'The requested path leaves the Project directory.')
  }
  try {
    return { path: canonical, stats: await stat(canonical) }
  } catch (error) {
    throw new ProjectFileError('file_unavailable', `File ${normalized} could not be inspected.`, {
      cause: error,
    })
  }
}
