import { readdir } from 'node:fs/promises'
import type { FileEntry, FilePage, FileView } from '@herdr-roam/shared'
import { readRawResolvedFile, readResolvedFile } from '../files/content.js'
import { normalizeSkillPath, resolveSkillEntry, SkillError } from './identity.js'

const excludedNames = new Set(['.DS_Store', '.git', 'node_modules'])
type Cursor = { readonly version: 1; readonly scope: string; readonly anchor: string }

const entryKey = (entry: FileEntry): string =>
  `${entry.kind === 'directory' ? '0' : '1'}:${entry.path}`

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
    throw new SkillError('invalid_cursor', 'The Skill file cursor is invalid.', { cause: error })
  }
}

const visibleEntry = async (
  root: string,
  directory: string,
  name: string,
): Promise<FileEntry | null> => {
  if (excludedNames.has(name) || (directory === '' && name === 'SKILL.md')) return null
  const path = directory ? `${directory}/${name}` : name
  try {
    const entry = await resolveSkillEntry(root, path)
    if (!entry.stats.isDirectory() && !entry.stats.isFile()) return null
    return { kind: entry.stats.isDirectory() ? 'directory' : 'file', name, path }
  } catch (error) {
    if (error instanceof SkillError && error.code === 'invalid_path') {
      console.error(`Unsafe supporting Skill entry omitted: ${path}`, error)
      return null
    }
    if (error instanceof SkillError && error.code === 'file_not_found') {
      console.error(`Broken supporting Skill entry omitted: ${path}`, error)
      return null
    }
    throw error
  }
}

export const listSkillDirectory = async (
  root: string,
  request: { readonly directory?: string; readonly cursor?: string; readonly limit: number },
): Promise<FilePage> => {
  const directory = normalizeSkillPath(request.directory ?? '', true)
  const target = directory ? await resolveSkillEntry(root, directory) : null
  if (target && !target.stats.isDirectory()) {
    throw new SkillError('file_not_found', `${directory} is not a directory.`)
  }
  let names: readonly string[]
  try {
    names = await readdir(target?.path ?? root)
  } catch (error) {
    throw new SkillError('file_unavailable', `Directory ${directory || '.'} could not be read.`, {
      cause: error,
    })
  }
  const entries = (
    await Promise.all(names.map(name => visibleEntry(root, directory, name)))
  ).flatMap(entry => (entry ? [entry] : []))
  const ordered = entries.toSorted((left, right) => entryKey(left).localeCompare(entryKey(right)))
  const scope = `directory:${directory}`
  const anchor = parseCursor(request.cursor, scope)
  const start = anchor ? ordered.findIndex(entry => entryKey(entry).localeCompare(anchor) > 0) : 0
  const index = start < 0 ? ordered.length : start
  const items = ordered.slice(index, index + request.limit)
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

export const readSkillFile = async (root: string, requestedPath: string): Promise<FileView> => {
  const relativePath = normalizeSkillPath(requestedPath)
  return readResolvedFile(relativePath, await resolveSkillEntry(root, relativePath))
}

export const readRawSkillFile = async (
  root: string,
  requestedPath: string,
): ReturnType<typeof readRawResolvedFile> => {
  const relativePath = normalizeSkillPath(requestedPath)
  return readRawResolvedFile(relativePath, await resolveSkillEntry(root, relativePath))
}
