import { randomUUID } from 'node:crypto'
import { mkdir, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute } from 'node:path'
import type { Project, ProjectCreateRequest, ProjectRegistrySnapshot } from '@herdr-roam/shared'
import { z } from 'zod'

const projectName = /^[a-z0-9][a-z0-9._-]{0,63}$/

const projectSchema = z
  .object({
    name: z.string().regex(projectName),
    path: z.string().refine(isAbsolute),
  })
  .strict()

const configSchema = z
  .object({
    version: z.literal(1),
    projects: z.array(projectSchema),
  })
  .strict()
  .superRefine((config, context) => {
    const names = new Set<string>()
    const paths = new Set<string>()
    config.projects.forEach((project, index) => {
      if (names.has(project.name)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate Project name ${project.name}.`,
          path: ['projects', index, 'name'],
        })
      }
      if (paths.has(project.path)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate Project path ${project.path}.`,
          path: ['projects', index, 'path'],
        })
      }
      names.add(project.name)
      paths.add(project.path)
    })
  })

type StoredConfig = z.infer<typeof configSchema>

export type ProjectRegistryErrorCode =
  | 'invalid_project'
  | 'project_name_taken'
  | 'project_path_taken'
  | 'project_directory_unavailable'
  | 'project_config_invalid'
  | 'project_config_unavailable'

export class ProjectRegistryError extends Error {
  readonly code: ProjectRegistryErrorCode
  readonly configPath: string

  constructor(
    code: ProjectRegistryErrorCode,
    message: string,
    configPath: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'ProjectRegistryError'
    this.code = code
    this.configPath = configPath
  }
}

export type ProjectRegistryApi = {
  readonly snapshot: () => Promise<ProjectRegistrySnapshot>
  readonly get: (name: string) => Promise<Project | null>
  readonly add: (request: ProjectCreateRequest) => Promise<Project>
}

const isMissing = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT'

const parseConfig = (text: string, configPath: string): StoredConfig => {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (error) {
    throw new ProjectRegistryError(
      'project_config_invalid',
      `Project configuration at ${configPath} is not valid JSON.`,
      configPath,
      { cause: error },
    )
  }
  const parsed = configSchema.safeParse(raw)
  if (!parsed.success) {
    throw new ProjectRegistryError(
      'project_config_invalid',
      `Project configuration at ${configPath} does not match version 1.`,
      configPath,
      { cause: parsed.error },
    )
  }
  return parsed.data
}

const readConfig = async (configPath: string): Promise<StoredConfig> => {
  try {
    return parseConfig(await readFile(configPath, 'utf8'), configPath)
  } catch (error) {
    if (isMissing(error)) return { version: 1, projects: [] }
    if (error instanceof ProjectRegistryError) throw error
    throw new ProjectRegistryError(
      'project_config_unavailable',
      `Project configuration at ${configPath} could not be read.`,
      configPath,
      { cause: error },
    )
  }
}

const canonicalDirectory = async (path: string, configPath: string): Promise<string> => {
  if (!isAbsolute(path)) {
    throw new ProjectRegistryError(
      'invalid_project',
      'Project path must be absolute.',
      configPath,
    )
  }
  try {
    const canonical = await realpath(path)
    if (!(await stat(canonical)).isDirectory()) {
      throw new ProjectRegistryError(
        'project_directory_unavailable',
        `Project path ${path} is not a directory.`,
        configPath,
      )
    }
    return canonical
  } catch (error) {
    if (error instanceof ProjectRegistryError) throw error
    throw new ProjectRegistryError(
      'project_directory_unavailable',
      `Project directory ${path} is unavailable.`,
      configPath,
      { cause: error },
    )
  }
}

const writeConfig = async (configPath: string, config: StoredConfig): Promise<void> => {
  const directory = dirname(configPath)
  const temporary = `${configPath}.${randomUUID()}.tmp`
  try {
    await mkdir(directory, { recursive: true, mode: 0o700 })
    await writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 })
    await rename(temporary, configPath)
  } catch (error) {
    throw new ProjectRegistryError(
      'project_config_unavailable',
      `Project configuration at ${configPath} could not be written.`,
      configPath,
      { cause: error },
    )
  }
}

export const createProjectRegistry = (configPath: string): ProjectRegistryApi => ({
  snapshot: async () => {
    const config = await readConfig(configPath)
    return { configPath, projects: config.projects }
  },
  get: async name => {
    const config = await readConfig(configPath)
    return config.projects.find(project => project.name === name) ?? null
  },
  add: async request => {
    if (!projectName.test(request.name)) {
      throw new ProjectRegistryError(
        'invalid_project',
        'Project name must be 1–64 lowercase letters, numbers, dots, underscores, or hyphens and start with a letter or number.',
        configPath,
      )
    }
    const path = await canonicalDirectory(request.path, configPath)
    const config = await readConfig(configPath)
    if (config.projects.some(project => project.name === request.name)) {
      throw new ProjectRegistryError(
        'project_name_taken',
        `Project name ${request.name} is already registered.`,
        configPath,
      )
    }
    if (config.projects.some(project => project.path === path)) {
      throw new ProjectRegistryError(
        'project_path_taken',
        `Project path ${path} is already registered.`,
        configPath,
      )
    }
    const project = { name: request.name, path }
    await writeConfig(configPath, { ...config, projects: [...config.projects, project] })
    return project
  },
})
