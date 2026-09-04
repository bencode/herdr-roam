import { execFile } from 'node:child_process'
import type { Dirent } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { ProjectFileEntry, ProjectFilePage } from '@herdr-roam/shared'
import {
  canonicalProjectRoot,
  normalizeProjectPath,
  ProjectFileError,
  resolveProjectEntry,
} from './path.js'

const execFileAsync = promisify(execFile)
const GIT_OUTPUT_LIMIT = 32 * 1024 * 1024
const FILESYSTEM_SCAN_LIMIT = 100_000
const excludedDirectories = new Set([
  '.git',
  '.cache',
  '.next',
  '.nuxt',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules',
])

type Cursor = { readonly version: 1; readonly scope: string; readonly anchor: string }
const execFilePromise = execFileAsync as (
  file: string,
  args: readonly string[],
  options: { readonly encoding: 'utf8'; readonly timeout: number; readonly maxBuffer: number },
) => Promise<{ readonly stdout: string; readonly stderr: string }>

const systemCode = (error: unknown): unknown =>
  typeof error === 'object' && error !== null && 'code' in error ? error.code : null

const systemStderr = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'stderr' in error && typeof error.stderr === 'string'
    ? error.stderr
    : ''

const gitProject = async (root: string): Promise<boolean> => {
  try {
    const { stdout } = await execFilePromise(
      'git',
      ['-C', root, 'rev-parse', '--is-inside-work-tree'],
      { encoding: 'utf8', timeout: 5_000, maxBuffer: 1024 },
    )
    return stdout.trim() === 'true'
  } catch (error) {
    if (systemCode(error) === 'ENOENT') {
      console.error(`Git availability check failed for ${root}`, error)
      return false
    }
    if (systemStderr(error).includes('not a git repository')) return false
    throw new ProjectFileError('file_unavailable', 'The Project Git state could not be read.', {
      cause: error,
    })
  }
}

const gitFiles = async (root: string, directory = ''): Promise<readonly string[]> => {
  const pathspec = directory ? [directory] : []
  try {
    const { stdout } = await execFilePromise(
      'git',
      [
        '-C',
        root,
        'ls-files',
        '-z',
        '--cached',
        '--others',
        '--exclude-standard',
        '--',
        ...pathspec,
      ],
      { encoding: 'utf8', timeout: 10_000, maxBuffer: GIT_OUTPUT_LIMIT },
    )
    return stdout.split('\0').filter(Boolean)
  } catch (error) {
    if (systemCode(error) === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
      throw new ProjectFileError(
        'catalog_too_large',
        'The Project file catalog is too large to browse safely.',
        { cause: error },
      )
    }
    throw new ProjectFileError('file_unavailable', 'Git files could not be listed.', {
      cause: error,
    })
  }
}

const entryKey = (entry: ProjectFileEntry): string =>
  `${entry.kind === 'directory' ? '0' : '1'}:${entry.path}`

const compareEntries = (left: ProjectFileEntry, right: ProjectFileEntry): number =>
  entryKey(left).localeCompare(entryKey(right))

const cursorText = (cursor: Cursor): string =>
  Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')

const parseCursor = (value: string | undefined, scope: string): string | null => {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('version' in parsed) ||
      parsed.version !== 1 ||
      !('scope' in parsed) ||
      parsed.scope !== scope ||
      !('anchor' in parsed) ||
      typeof parsed.anchor !== 'string'
    ) {
      throw new Error('Cursor shape is invalid.')
    }
    return parsed.anchor
  } catch (error) {
    throw new ProjectFileError('invalid_cursor', 'The file cursor is invalid.', { cause: error })
  }
}

const page = (
  values: readonly ProjectFileEntry[],
  scope: string,
  cursor: string | undefined,
  limit: number,
): ProjectFilePage => {
  const ordered = values.toSorted(compareEntries)
  const anchor = parseCursor(cursor, scope)
  const start = anchor ? ordered.findIndex(item => entryKey(item).localeCompare(anchor) > 0) : 0
  const index = start < 0 ? ordered.length : start
  const items = ordered.slice(index, index + limit)
  const last = items.at(-1)
  return {
    items,
    total: ordered.length,
    nextCursor:
      last && index + items.length < ordered.length
        ? cursorText({ version: 1, scope, anchor: entryKey(last) })
        : null,
  }
}

const gitDirectoryEntries = (
  files: readonly string[],
  directory: string,
): readonly ProjectFileEntry[] => {
  const prefix = directory ? `${directory}/` : ''
  const entries = new Map<string, ProjectFileEntry>()
  files.forEach(path => {
    if (!path.startsWith(prefix)) return
    const rest = path.slice(prefix.length)
    const [name, ...descendants] = rest.split('/')
    if (!name) return
    const itemPath = prefix ? `${directory}/${name}` : name
    const kind = descendants.length > 0 ? 'directory' : 'file'
    const existing = entries.get(itemPath)
    if (!existing || existing.kind === 'file') entries.set(itemPath, { kind, name, path: itemPath })
  })
  return [...entries.values()]
}

const filesystemDirectoryEntries = async (
  root: string,
  directory: string,
): Promise<readonly ProjectFileEntry[]> => {
  const target = directory
    ? await resolveProjectEntry(root, directory)
    : { path: root, stats: null }
  if (target.stats && !target.stats.isDirectory()) {
    throw new ProjectFileError('file_not_found', `${directory} is not a directory.`)
  }
  try {
    const values = await readdir(target.path, { withFileTypes: true })
    return values.flatMap(entry => {
      if (
        entry.name === '.DS_Store' ||
        (entry.isDirectory() && excludedDirectories.has(entry.name))
      ) {
        return []
      }
      const path = directory ? `${directory}/${entry.name}` : entry.name
      return [{ kind: entry.isDirectory() ? 'directory' : 'file', name: entry.name, path } as const]
    })
  } catch (error) {
    throw new ProjectFileError(
      'file_unavailable',
      `Directory ${directory || '.'} could not be read.`,
      {
        cause: error,
      },
    )
  }
}

const filesystemFiles = async (root: string): Promise<readonly string[]> => {
  const paths: string[] = []
  const pending = ['']
  let scanned = 0
  while (pending.length > 0) {
    const directory = pending.pop() ?? ''
    let entries: Dirent<string>[]
    try {
      entries = await readdir(join(root, ...directory.split('/').filter(Boolean)), {
        withFileTypes: true,
      })
    } catch (error) {
      console.error(`Directory ${directory || '.'} could not be searched`, error)
      continue
    }
    scanned += entries.length
    if (scanned > FILESYSTEM_SCAN_LIMIT) {
      throw new ProjectFileError(
        'catalog_too_large',
        'The Project contains too many files for fallback search.',
      )
    }
    entries.forEach(entry => {
      if (
        entry.name === '.DS_Store' ||
        (entry.isDirectory() && excludedDirectories.has(entry.name))
      ) {
        return
      }
      const path = directory ? `${directory}/${entry.name}` : entry.name
      if (entry.isDirectory()) pending.push(path)
      else paths.push(path)
    })
  }
  return paths
}

const fileEntries = (paths: readonly string[]): readonly ProjectFileEntry[] =>
  paths.map(path => ({ kind: 'file', name: path.split('/').at(-1) ?? path, path }))

export const listProjectDirectory = async (
  projectPath: string,
  request: {
    readonly directory?: string
    readonly cursor?: string
    readonly limit: number
  },
): Promise<ProjectFilePage> => {
  const root = await canonicalProjectRoot(projectPath)
  const directory = normalizeProjectPath(request.directory ?? '', true)
  const entries = (await gitProject(root))
    ? gitDirectoryEntries(await gitFiles(root, directory), directory)
    : await filesystemDirectoryEntries(root, directory)
  return page(entries, `directory:${directory}`, request.cursor, request.limit)
}

export const searchProjectFiles = async (
  projectPath: string,
  request: { readonly query: string; readonly cursor?: string; readonly limit: number },
): Promise<ProjectFilePage> => {
  const query = request.query.trim().toLowerCase()
  if (!query) throw new ProjectFileError('invalid_path', 'A file search query is required.')
  const root = await canonicalProjectRoot(projectPath)
  const paths = (await gitProject(root)) ? await gitFiles(root) : await filesystemFiles(root)
  const matches = fileEntries(paths.filter(path => path.toLowerCase().includes(query)))
  return page(matches, `search:${query}`, request.cursor, request.limit)
}
