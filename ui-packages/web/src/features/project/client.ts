import type {
  ProjectApiError,
  ProjectCreateRequest,
  ProjectMutationReceipt,
  ProjectRegistrySnapshot,
} from '@herdr-roam/shared'
import { z } from 'zod'

const projectSchema = z.object({ name: z.string().min(1), path: z.string().min(1) })
const snapshotSchema = z.object({
  configPath: z.string().min(1),
  projects: z.array(projectSchema).readonly(),
})
const receiptSchema = snapshotSchema.extend({ project: projectSchema })
const errorSchema = z.object({
  error: z.object({
    code: z.enum([
      'invalid_project',
      'project_not_found',
      'project_directory_unavailable',
      'project_config_invalid',
      'project_config_unavailable',
      'internal_error',
    ]),
    message: z.string().min(1),
    configPath: z.string().min(1).optional(),
  }),
})

export class ProjectClientError extends Error {
  readonly code: ProjectApiError['error']['code'] | 'invalid_response' | 'network_error'
  readonly configPath: string | null

  constructor(
    code: ProjectClientError['code'],
    message: string,
    configPath: string | null = null,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'ProjectClientError'
    this.code = code
    this.configPath = configPath
  }
}

const responseJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json()
  } catch (error) {
    throw new ProjectClientError('invalid_response', 'The server returned invalid JSON.', null, {
      cause: error,
    })
  }
}

const parsedResponse = async <Value>(
  response: Response,
  parse: (value: unknown) => Value,
): Promise<Value> => {
  const body = await responseJson(response)
  if (!response.ok) {
    const parsed = errorSchema.safeParse(body)
    if (parsed.success) {
      throw new ProjectClientError(
        parsed.data.error.code,
        parsed.data.error.message,
        parsed.data.error.configPath ?? null,
      )
    }
    throw new ProjectClientError('invalid_response', `The server returned HTTP ${response.status}.`)
  }
  try {
    return parse(body)
  } catch (error) {
    throw new ProjectClientError(
      'invalid_response',
      'The server returned invalid Project data.',
      null,
      {
        cause: error,
      },
    )
  }
}

const networkError = (error: unknown): never => {
  if (error instanceof ProjectClientError) throw error
  throw new ProjectClientError('network_error', 'Herdr Roam could not be reached.', null, {
    cause: error,
  })
}

export const fetchProjects = async (): Promise<ProjectRegistrySnapshot> => {
  try {
    return await parsedResponse(await fetch('/api/projects'), snapshotSchema.parse)
  } catch (error) {
    return networkError(error)
  }
}

export const createProject = async (
  request: ProjectCreateRequest,
): Promise<ProjectMutationReceipt> => {
  try {
    return await parsedResponse(
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      }),
      receiptSchema.parse,
    )
  } catch (error) {
    return networkError(error)
  }
}

export const removeProject = async (projectName: string): Promise<ProjectMutationReceipt> => {
  try {
    return await parsedResponse(
      await fetch(`/api/projects/${encodeURIComponent(projectName)}`, { method: 'DELETE' }),
      receiptSchema.parse,
    )
  } catch (error) {
    return networkError(error)
  }
}

export const subscribeProjectSnapshots = (
  onSnapshot: (snapshot: ProjectRegistrySnapshot) => void,
  onError: (error: ProjectClientError) => void,
): (() => void) => {
  const source = new EventSource('/api/projects/events')
  source.addEventListener('snapshot', event => {
    try {
      onSnapshot(snapshotSchema.parse(JSON.parse(event.data)))
    } catch (error) {
      onError(
        new ProjectClientError(
          'invalid_response',
          'The Project event stream returned invalid data.',
          null,
          {
            cause: error,
          },
        ),
      )
    }
  })
  source.addEventListener('error', () => {
    onError(new ProjectClientError('network_error', 'Project updates are reconnecting.'))
  })
  return () => source.close()
}
