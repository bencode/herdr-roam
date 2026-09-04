import type { ProjectFileApiError, ProjectFilePage, ProjectFileView } from '@herdr-roam/shared'
import { z } from 'zod'
import { filePageSchema, fileViewSchema } from './schema'
const errorSchema = z.object({
  error: z.object({
    code: z.enum([
      'invalid_path',
      'invalid_cursor',
      'project_not_found',
      'project_directory_unavailable',
      'file_not_found',
      'file_unavailable',
      'file_unsupported',
      'catalog_too_large',
      'internal_error',
    ]),
    message: z.string().min(1),
  }),
})

export class FileClientError extends Error {
  readonly code: ProjectFileApiError['error']['code'] | 'invalid_response' | 'network_error'

  constructor(code: FileClientError['code'], message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'FileClientError'
    this.code = code
  }
}

const fileRoot = (projectName: string): string =>
  `/api/projects/${encodeURIComponent(projectName)}/files`

const queryPath = (
  path: string,
  values: Readonly<Record<string, string | number | undefined>>,
): string => {
  const query = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value))
  })
  const suffix = query.toString()
  return suffix ? `${path}?${suffix}` : path
}

const request = async <Value>(
  path: string,
  parse: (body: unknown) => Value,
  signal?: AbortSignal,
): Promise<Value> => {
  try {
    const response = await fetch(path, { signal })
    let body: unknown
    try {
      body = await response.json()
    } catch (error) {
      throw new FileClientError('invalid_response', 'The server returned invalid JSON.', {
        cause: error,
      })
    }
    if (!response.ok) {
      const parsed = errorSchema.safeParse(body)
      if (parsed.success)
        throw new FileClientError(parsed.data.error.code, parsed.data.error.message)
      throw new FileClientError('invalid_response', `The server returned HTTP ${response.status}.`)
    }
    try {
      return parse(body)
    } catch (error) {
      throw new FileClientError('invalid_response', 'The server returned invalid file data.', {
        cause: error,
      })
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    if (error instanceof FileClientError) throw error
    throw new FileClientError('network_error', 'Herdr Roam could not be reached.', { cause: error })
  }
}

export const fetchProjectFiles = (
  projectName: string,
  options: {
    readonly directory?: string
    readonly cursor?: string
    readonly limit?: number
    readonly signal?: AbortSignal
  } = {},
): Promise<ProjectFilePage> =>
  request(
    queryPath(fileRoot(projectName), {
      directory: options.directory,
      cursor: options.cursor,
      limit: options.limit,
    }),
    filePageSchema.parse,
    options.signal,
  )

export const searchProjectFiles = (
  projectName: string,
  query: string,
  options: {
    readonly cursor?: string
    readonly limit?: number
    readonly signal?: AbortSignal
  } = {},
): Promise<ProjectFilePage> =>
  request(
    queryPath(`${fileRoot(projectName)}/search`, {
      query,
      cursor: options.cursor,
      limit: options.limit,
    }),
    filePageSchema.parse,
    options.signal,
  )

export const fetchProjectFile = (
  projectName: string,
  path: string,
  signal?: AbortSignal,
): Promise<ProjectFileView> =>
  request(queryPath(`${fileRoot(projectName)}/view`, { path }), fileViewSchema.parse, signal)

export const projectFileRawUrl = (projectName: string, path: string): string =>
  `${fileRoot(projectName)}/raw/${path.split('/').map(encodeURIComponent).join('/')}`
