import type {
  ProjectFileApiError,
  ProjectFileEntry,
  ProjectFilePage,
  ProjectFileView,
} from '@herdr-roam/shared'
import { z } from 'zod'
import { filePageSchema, fileSearchEventSchema, fileViewSchema } from './schema'
const errorSchema = z.object({
  error: z.object({
    code: z.enum([
      'invalid_path',
      'invalid_cursor',
      'project_not_found',
      'project_directory_unavailable',
      'workspace_not_found',
      'workspace_directory_unavailable',
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

const projectRoot = (projectName: string): string =>
  `/api/projects/${encodeURIComponent(projectName)}`

const fileRoot = (projectName: string, workspaceId: string): string =>
  `${projectRoot(projectName)}/workspaces/${encodeURIComponent(workspaceId)}/files`

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

const serverError = (body: unknown, status: number): FileClientError => {
  const parsed = errorSchema.safeParse(body)
  return parsed.success
    ? new FileClientError(parsed.data.error.code, parsed.data.error.message)
    : new FileClientError('invalid_response', `The server returned HTTP ${status}.`)
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
    if (!response.ok) throw serverError(body, response.status)
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
  workspaceId: string,
  options: {
    readonly directory?: string
    readonly cursor?: string
    readonly limit?: number
    readonly signal?: AbortSignal
  } = {},
): Promise<ProjectFilePage> =>
  request(
    queryPath(fileRoot(projectName, workspaceId), {
      directory: options.directory,
      cursor: options.cursor,
      limit: options.limit,
    }),
    filePageSchema.parse,
    options.signal,
  )

const searchEvent = (line: string) => {
  try {
    return fileSearchEventSchema.parse(JSON.parse(line))
  } catch (error) {
    throw new FileClientError('invalid_response', 'The server returned an invalid search event.', {
      cause: error,
    })
  }
}

async function* responseLines(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder()
  const reader = body.getReader()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      yield* lines.filter(Boolean)
      if (done) break
    }
    if (buffer) yield buffer
  } finally {
    await reader.cancel()
  }
}

export const searchProjectFiles = async (
  projectName: string,
  workspaceId: string,
  query: string,
  options: {
    readonly onMatch: (entry: ProjectFileEntry) => void
    readonly signal?: AbortSignal
  },
): Promise<{ readonly truncated: boolean }> => {
  try {
    const response = await fetch(
      queryPath(`${fileRoot(projectName, workspaceId)}/search`, { query }),
      { signal: options.signal },
    )
    if (!response.ok) {
      let body: unknown
      try {
        body = await response.json()
      } catch (error) {
        throw new FileClientError('invalid_response', 'The server returned invalid JSON.', {
          cause: error,
        })
      }
      throw serverError(body, response.status)
    }
    if (!response.body)
      throw new FileClientError('invalid_response', 'The search returned no body.')
    for await (const line of responseLines(response.body)) {
      const event = searchEvent(line)
      if (event.type === 'match') options.onMatch(event.entry)
      else if (event.type === 'done') return { truncated: event.truncated }
      else throw serverError({ error: event.error }, response.status)
    }
    throw new FileClientError('invalid_response', 'The search ended unexpectedly.')
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    if (error instanceof FileClientError) throw error
    throw new FileClientError('network_error', 'Herdr Roam could not be reached.', { cause: error })
  }
}

export const fetchProjectFile = (
  projectName: string,
  workspaceId: string,
  path: string,
  signal?: AbortSignal,
): Promise<ProjectFileView> =>
  request(
    queryPath(`${fileRoot(projectName, workspaceId)}/view`, { path }),
    fileViewSchema.parse,
    signal,
  )

export const projectFileRawUrl = (projectName: string, workspaceId: string, path: string): string =>
  `${fileRoot(projectName, workspaceId)}/raw/${path.split('/').map(encodeURIComponent).join('/')}`
