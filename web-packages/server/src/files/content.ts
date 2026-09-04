import type { Stats } from 'node:fs'
import { open, readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import type { FileMetadata, FileView } from '@herdr-roam/shared'
import {
  canonicalProjectRoot,
  normalizeProjectPath,
  ProjectFileError,
  resolveProjectEntry,
} from './path.js'

export const PROJECT_TEXT_MAX_BYTES = 1024 * 1024
export const PROJECT_RAW_MAX_BYTES = 20 * 1024 * 1024
const SAMPLE_BYTES = 4096

const languages: Readonly<Record<string, string>> = {
  '.bash': 'bash',
  '.c': 'c',
  '.cc': 'cpp',
  '.clj': 'clojure',
  '.cljs': 'clojure',
  '.cpp': 'cpp',
  '.css': 'css',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.go': 'go',
  '.graphql': 'graphql',
  '.h': 'c',
  '.hpp': 'cpp',
  '.java': 'java',
  '.js': 'javascript',
  '.json': 'json',
  '.jsonc': 'json',
  '.jsx': 'jsx',
  '.kt': 'kotlin',
  '.lua': 'lua',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.mjs': 'javascript',
  '.mts': 'typescript',
  '.nu': 'bash',
  '.php': 'php',
  '.proto': 'protobuf',
  '.py': 'python',
  '.rb': 'ruby',
  '.rs': 'rust',
  '.scss': 'scss',
  '.sh': 'bash',
  '.sql': 'sql',
  '.swift': 'swift',
  '.toml': 'toml',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.txt': 'text',
  '.xml': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.zsh': 'bash',
}

const specialLanguages: Readonly<Record<string, string>> = {
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  gemfile: 'ruby',
  rakefile: 'ruby',
  '.env': 'bash',
  '.gitignore': 'text',
  '.gitattributes': 'text',
}

const mediaTypes: Readonly<Record<string, string>> = {
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.css': 'text/css',
  '.gif': 'image/gif',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.mmd': 'text/plain',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const imageExtensions = new Set([
  '.avif',
  '.bmp',
  '.gif',
  '.ico',
  '.jpeg',
  '.jpg',
  '.png',
  '.svg',
  '.webp',
])
const rawExtensions = new Set([...imageExtensions, '.css', '.otf', '.ttf', '.woff', '.woff2'])

const extensionOf = (path: string): string => extname(path).toLowerCase()
const mediaTypeOf = (path: string): string =>
  mediaTypes[extensionOf(path)] ?? 'application/octet-stream'
const languageOf = (path: string): string => {
  const name = path.split('/').at(-1)?.toLowerCase() ?? ''
  return specialLanguages[name] ?? languages[extensionOf(path)] ?? 'text'
}

const sampleFile = async (path: string, size: number): Promise<Buffer> => {
  const handle = await open(path, 'r')
  try {
    const sample = Buffer.alloc(Math.min(size, SAMPLE_BYTES))
    const { bytesRead } = await handle.read(sample, 0, sample.length, 0)
    return sample.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

const textSample = (value: Uint8Array): boolean => {
  if (value.includes(0)) return false
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(value)
    return true
  } catch (error) {
    if (!(error instanceof TypeError)) console.error('UTF-8 sample detection failed', error)
    return false
  }
}

const startsWith = (value: Uint8Array, prefix: readonly number[]): boolean =>
  prefix.every((byte, index) => value[index] === byte)

const validImageSample = (extension: string, value: Uint8Array): boolean => {
  if (extension === '.png')
    return startsWith(value, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (extension === '.jpg' || extension === '.jpeg') return startsWith(value, [0xff, 0xd8, 0xff])
  if (extension === '.gif')
    return Buffer.from(value.subarray(0, 6)).toString('ascii').startsWith('GIF8')
  if (extension === '.webp')
    return (
      Buffer.from(value.subarray(0, 4)).toString('ascii') === 'RIFF' &&
      Buffer.from(value.subarray(8, 12)).toString('ascii') === 'WEBP'
    )
  if (extension === '.bmp') return startsWith(value, [0x42, 0x4d])
  if (extension === '.ico') return startsWith(value, [0x00, 0x00, 0x01, 0x00])
  if (extension === '.avif')
    return (
      Buffer.from(value.subarray(4, 8)).toString('ascii') === 'ftyp' &&
      Buffer.from(value.subarray(8, 32)).toString('ascii').includes('avif')
    )
  if (extension !== '.svg' || !textSample(value)) return false
  return /^\s*(?:<\?xml[^>]*>\s*)?<svg(?:\s|>)/i.test(new TextDecoder().decode(value))
}

const metadata = (relativePath: string, stats: Stats): FileMetadata => ({
  path: relativePath,
  name: relativePath.split('/').at(-1) ?? relativePath,
  size: stats.size,
  modifiedAt: stats.mtime.toISOString(),
  mediaType: mediaTypeOf(relativePath),
})

const textKind = (path: string): 'markdown' | 'html' | 'mermaid' | 'text' => {
  const extension = extensionOf(path)
  if (extension === '.md' || extension === '.markdown') return 'markdown'
  if (extension === '.html' || extension === '.htm') return 'html'
  if (extension === '.mmd') return 'mermaid'
  return 'text'
}

export const readResolvedFile = async (
  relativePath: string,
  entry: { readonly path: string; readonly stats: Stats },
): Promise<FileView> => {
  if (!entry.stats.isFile()) {
    throw new ProjectFileError('file_not_found', `${relativePath} is not a file.`)
  }
  const details = metadata(relativePath, entry.stats)
  const extension = extensionOf(relativePath)
  if (imageExtensions.has(extension)) {
    const sample = await sampleFile(entry.path, entry.stats.size)
    if (!validImageSample(extension, sample)) return { ...details, kind: 'binary' }
    return entry.stats.size > PROJECT_RAW_MAX_BYTES
      ? { ...details, kind: 'oversized', previewKind: 'image', limit: PROJECT_RAW_MAX_BYTES }
      : { ...details, kind: 'image' }
  }

  const knownText =
    extension === '.markdown' ||
    extension === '.html' ||
    extension === '.htm' ||
    extension === '.mmd' ||
    Boolean(languages[extension]) ||
    Boolean(specialLanguages[details.name.toLowerCase()])
  const sample = knownText ? null : await sampleFile(entry.path, entry.stats.size)
  if (!knownText && sample && !textSample(sample)) return { ...details, kind: 'binary' }
  const textDetails = {
    ...details,
    mediaType: details.mediaType === 'application/octet-stream' ? 'text/plain' : details.mediaType,
  }
  if (entry.stats.size > PROJECT_TEXT_MAX_BYTES) {
    return { ...textDetails, kind: 'oversized', previewKind: 'text', limit: PROJECT_TEXT_MAX_BYTES }
  }

  const bytes = await readFile(entry.path)
  if (!textSample(bytes)) return { ...details, kind: 'binary' }
  return {
    ...textDetails,
    kind: textKind(relativePath),
    language: languageOf(relativePath),
    content: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
  }
}

export const readProjectFile = async (
  projectPath: string,
  requestedPath: string,
): Promise<FileView> => {
  const relativePath = normalizeProjectPath(requestedPath)
  const root = await canonicalProjectRoot(projectPath)
  return readResolvedFile(relativePath, await resolveProjectEntry(root, relativePath))
}

export const readRawResolvedFile = async (
  relativePath: string,
  entry: { readonly path: string; readonly stats: Stats },
): Promise<{
  readonly path: string
  readonly mediaType: string
  readonly size: number
  readonly svg: boolean
}> => {
  const extension = extensionOf(relativePath)
  if (!rawExtensions.has(extension)) {
    throw new ProjectFileError('file_unsupported', 'This file type cannot be served as an asset.')
  }
  if (!entry.stats.isFile())
    throw new ProjectFileError('file_not_found', 'The asset was not found.')
  if (entry.stats.size > PROJECT_RAW_MAX_BYTES) {
    throw new ProjectFileError('file_unsupported', 'The asset is too large to preview.')
  }
  if (imageExtensions.has(extension)) {
    const sample = await sampleFile(entry.path, entry.stats.size)
    if (!validImageSample(extension, sample)) {
      throw new ProjectFileError('file_unsupported', 'The asset content does not match its type.')
    }
  }
  return {
    path: entry.path,
    mediaType: mediaTypeOf(relativePath),
    size: entry.stats.size,
    svg: extension === '.svg',
  }
}

export const readRawProjectFile = async (
  projectPath: string,
  requestedPath: string,
): ReturnType<typeof readRawResolvedFile> => {
  const relativePath = normalizeProjectPath(requestedPath)
  const root = await canonicalProjectRoot(projectPath)
  return readRawResolvedFile(relativePath, await resolveProjectEntry(root, relativePath))
}
