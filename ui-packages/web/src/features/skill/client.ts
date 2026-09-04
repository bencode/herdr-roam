import type {
  FilePage,
  FileView,
  SkillApiError,
  SkillCatalog,
  SkillDetail,
  SkillSource,
} from '@herdr-roam/shared'
import { z } from 'zod'
import type { ResourceRef } from '../../workbench/resource'
import { filePageSchema, fileViewSchema } from '../file/schema'

type SkillResource = Extract<ResourceRef, { type: 'skill' }>

const sourceSchema = z.enum(['agents', 'codex', 'claude'])
const scopeSchema = z.enum(['user', 'project'])
const summaryShape = {
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  source: sourceSchema,
  scope: scopeSchema,
  projectName: z.string().min(1).optional(),
  location: z.string().min(1),
}
const summarySchema = z.object(summaryShape)
const catalogSchema = z.object({
  items: z.array(summarySchema).readonly(),
  warnings: z
    .array(
      z.object({
        scope: scopeSchema,
        source: sourceSchema,
        location: z.string().min(1),
        code: z.enum(['invalid_skill', 'skill_unavailable']),
        message: z.string().min(1),
      }),
    )
    .readonly(),
})
const detailSchema = z.object({ ...summaryShape, document: fileViewSchema })
const errorSchema = z.object({
  error: z.object({
    code: z.enum([
      'invalid_skill',
      'skill_not_found',
      'skill_unavailable',
      'project_not_found',
      'project_directory_unavailable',
      'invalid_path',
      'invalid_cursor',
      'file_not_found',
      'file_unavailable',
      'file_unsupported',
      'internal_error',
    ]),
    message: z.string().min(1),
  }),
})

export class SkillClientError extends Error {
  readonly code: SkillApiError['error']['code'] | 'invalid_response' | 'network_error'

  constructor(code: SkillClientError['code'], message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SkillClientError'
    this.code = code
  }
}

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
  parseBody: (body: unknown) => Value,
  signal?: AbortSignal,
): Promise<Value> => {
  try {
    const response = await fetch(path, { signal })
    let body: unknown
    try {
      body = await response.json()
    } catch (error) {
      throw new SkillClientError('invalid_response', 'The server returned invalid JSON.', {
        cause: error,
      })
    }
    if (!response.ok) {
      const parsed = errorSchema.safeParse(body)
      if (parsed.success) {
        throw new SkillClientError(parsed.data.error.code, parsed.data.error.message)
      }
      throw new SkillClientError('invalid_response', `The server returned HTTP ${response.status}.`)
    }
    try {
      return parseBody(body)
    } catch (error) {
      throw new SkillClientError('invalid_response', 'The server returned invalid Skill data.', {
        cause: error,
      })
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    if (error instanceof SkillClientError) throw error
    throw new SkillClientError('network_error', 'Herdr Roam could not be reached.', {
      cause: error,
    })
  }
}

const resourceRoot = (resource: SkillResource): string =>
  `/api/skills/${resource.scope}/${encodeURIComponent(resource.skillId)}`

const projectName = (resource: SkillResource): string | undefined =>
  resource.scope === 'project' ? resource.projectName : undefined

export const fetchSkillCatalog = (project: string, signal?: AbortSignal): Promise<SkillCatalog> =>
  request(queryPath('/api/skills', { project: project || undefined }), catalogSchema.parse, signal)

export const fetchSkillDetail = (
  resource: SkillResource,
  signal?: AbortSignal,
): Promise<SkillDetail> =>
  request(
    queryPath(resourceRoot(resource), { project: projectName(resource) }),
    detailSchema.parse,
    signal,
  )

export const fetchSkillFiles = (
  resource: SkillResource,
  options: {
    readonly directory?: string
    readonly cursor?: string
    readonly limit?: number
    readonly signal?: AbortSignal
  } = {},
): Promise<FilePage> =>
  request(
    queryPath(`${resourceRoot(resource)}/files`, {
      project: projectName(resource),
      directory: options.directory,
      cursor: options.cursor,
      limit: options.limit,
    }),
    filePageSchema.parse,
    options.signal,
  )

export const fetchSkillFile = (
  resource: SkillResource,
  path: string,
  signal?: AbortSignal,
): Promise<FileView> =>
  request(
    queryPath(`${resourceRoot(resource)}/files/view`, {
      project: projectName(resource),
      path,
    }),
    fileViewSchema.parse,
    signal,
  )

export const skillFileRawUrl = (resource: SkillResource, path: string): string =>
  queryPath(
    `${resourceRoot(resource)}/files/raw/${path.split('/').map(encodeURIComponent).join('/')}`,
    { project: projectName(resource) },
  )

export const skillSourceLabel = (source: SkillSource): string =>
  ({ agents: 'Agents', codex: 'Codex', claude: 'Claude' })[source]
