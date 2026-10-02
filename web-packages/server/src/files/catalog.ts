import type { Dirent } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { ProjectFileEntry, ProjectFilePage } from '@herdr-roam/shared'
import {
  canonicalProjectRoot,
  normalizeProjectPath,
  ProjectFileError,
  resolveProjectEntry,
} from './path.js'

type Cursor = { readonly version: 1; readonly scope: string; readonly anchor: string }

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
    return values.map(entry => ({
      kind: entry.isDirectory() ? 'directory' : 'file',
      name: entry.name,
      path: directory ? `${directory}/${entry.name}` : entry.name,
    }))
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
  const entries = await filesystemDirectoryEntries(root, directory)
  return page(entries, `directory:${directory}`, request.cursor, request.limit)
}

async function* walkMatches(
  root: string,
  query: string,
  signal: AbortSignal,
): AsyncGenerator<ProjectFileEntry> {
  const pending = ['']
  for (let index = 0; index < pending.length && !signal.aborted; index += 1) {
    const directory = pending[index] ?? ''
    let entries: Dirent<string>[]
    try {
      entries = await readdir(join(root, ...directory.split('/').filter(Boolean)), {
        withFileTypes: true,
      })
    } catch (error) {
      console.error(`Directory ${directory || '.'} could not be searched`, error)
      continue
    }
    for (const entry of entries) {
      const path = directory ? `${directory}/${entry.name}` : entry.name
      if (entry.isDirectory()) pending.push(path)
      else if (path.toLowerCase().includes(query)) yield { kind: 'file', name: entry.name, path }
    }
  }
}

export const searchProjectFiles = async (
  projectPath: string,
  query: string,
  signal: AbortSignal,
): Promise<AsyncGenerator<ProjectFileEntry>> => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) throw new ProjectFileError('invalid_path', 'A file search query is required.')
  return walkMatches(await canonicalProjectRoot(projectPath), normalized, signal)
}
