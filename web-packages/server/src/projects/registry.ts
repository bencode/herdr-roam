import { randomUUID } from 'node:crypto'
import { mkdir, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute } from 'node:path'
import type { Project, ProjectCreateRequest, ProjectRegistrySnapshot } from '@herdr-roam/shared'
import { z } from 'zod'

const projectName = /^[a-z0-9][a-z0-9._-]{0,63}$/

const projectSchema = z
  .object({
    name: z.string().regex(projectName),
    path: z.string().refine(isAbsolute),
  })
  .strict()

const uniqueProjects = (projects: readonly Project[], context: z.RefinementCtx): void => {
  const names = new Set<string>()
  const paths = new Set<string>()
  projects.forEach((project, index) => {
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
}

const configV1Schema = z
  .object({ version: z.literal(1), projects: z.array(projectSchema) })
  .strict()
  .superRefine((config, context) => uniqueProjects(config.projects, context))

const configV2Schema = z
  .object({
    version: z.literal(2),
    projects: z.array(projectSchema),
    ignoredProjectPaths: z.array(z.string().refine(isAbsolute)),
  })
  .strict()
  .superRefine((config, context) => {
    uniqueProjects(config.projects, context)
    const ignored = new Set<string>()
    config.ignoredProjectPaths.forEach((path, index) => {
      if (ignored.has(path)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate ignored Project path ${path}.`,
          path: ['ignoredProjectPaths', index],
        })
      }
      if (config.projects.some(project => project.path === path)) {
        context.addIssue({
          code: 'custom',
          message: `Active Project path ${path} cannot also be ignored.`,
          path: ['ignoredProjectPaths', index],
        })
      }
      ignored.add(path)
    })
  })

type StoredConfig = z.infer<typeof configV2Schema>

export type ProjectRegistryErrorCode =
  | 'invalid_project'
  | 'project_not_found'
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

type Listener = (snapshot: ProjectRegistrySnapshot) => void

export type ProjectRegistryApi = {
  readonly snapshot: () => Promise<ProjectRegistrySnapshot>
  readonly get: (name: string) => Promise<Project | null>
  readonly add: (request: ProjectCreateRequest) => Promise<Project>
  readonly discover: (paths: readonly string[]) => Promise<void>
  readonly remove: (name: string) => Promise<Project>
  readonly subscribe: (listener: Listener) => () => void
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
  const v2 = configV2Schema.safeParse(raw)
  if (v2.success) return v2.data
  const v1 = configV1Schema.safeParse(raw)
  if (v1.success) return { version: 2, projects: v1.data.projects, ignoredProjectPaths: [] }
  throw new ProjectRegistryError(
    'project_config_invalid',
    `Project configuration at ${configPath} does not match a supported version.`,
    configPath,
    { cause: v2.error },
  )
}

const readConfig = async (configPath: string): Promise<StoredConfig> => {
  try {
    return parseConfig(await readFile(configPath, 'utf8'), configPath)
  } catch (error) {
    if (isMissing(error)) return { version: 2, projects: [], ignoredProjectPaths: [] }
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
    throw new ProjectRegistryError('invalid_project', 'Project path must be absolute.', configPath)
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

const normalizedName = (path: string): string => {
  const name = basename(path)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .slice(0, 64)
  return name || 'project'
}

const availableName = (path: string, names: ReadonlySet<string>): string => {
  const base = normalizedName(path)
  return (
    Array.from({ length: names.size + 2 }, (_, index) => {
      const suffix = index === 0 ? '' : `-${index + 1}`
      return `${base.slice(0, 64 - suffix.length).replace(/[-._]+$/, '')}${suffix}`
    }).find(name => !names.has(name)) ?? `project-${names.size + 2}`
  )
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

const publicSnapshot = (configPath: string, config: StoredConfig): ProjectRegistrySnapshot => ({
  configPath,
  projects: config.projects,
})

export const createProjectRegistry = (configPath: string): ProjectRegistryApi => {
  const listeners = new Set<Listener>()
  let mutationQueue: Promise<void> = Promise.resolve()

  const notify = (config: StoredConfig) => {
    const snapshot = publicSnapshot(configPath, config)
    listeners.forEach(listener => {
      try {
        listener(snapshot)
      } catch (error) {
        console.error('Project registry listener failed', error)
      }
    })
  }

  const mutate = <Value>(operation: () => Promise<Value>): Promise<Value> => {
    const result = mutationQueue.then(operation, operation)
    mutationQueue = result.then(
      () => undefined,
      error => {
        if (!(error instanceof ProjectRegistryError)) {
          console.error('Project registry mutation failed', error)
        }
      },
    )
    return result
  }

  return {
    snapshot: async () => publicSnapshot(configPath, await readConfig(configPath)),
    get: async name =>
      (await readConfig(configPath)).projects.find(project => project.name === name) ?? null,
    add: request =>
      mutate(async () => {
        const path = await canonicalDirectory(request.path, configPath)
        const config = await readConfig(configPath)
        const existing = config.projects.find(project => project.path === path)
        if (existing) return existing
        const project = {
          name: availableName(path, new Set(config.projects.map(item => item.name))),
          path,
        }
        const next = {
          ...config,
          projects: [...config.projects, project],
          ignoredProjectPaths: config.ignoredProjectPaths.filter(item => item !== path),
        }
        await writeConfig(configPath, next)
        notify(next)
        return project
      }),
    discover: paths =>
      mutate(async () => {
        const canonicalPaths = await Promise.all(
          [...new Set(paths)].map(path => canonicalDirectory(path, configPath)),
        )
        const config = await readConfig(configPath)
        const knownPaths = new Set(config.projects.map(project => project.path))
        const ignoredPaths = new Set(config.ignoredProjectPaths)
        const names = new Set(config.projects.map(project => project.name))
        const additions = [...new Set(canonicalPaths)]
          .filter(path => !knownPaths.has(path) && !ignoredPaths.has(path))
          .toSorted()
          .map(path => {
            const project = { name: availableName(path, names), path }
            names.add(project.name)
            return project
          })
        if (additions.length === 0) return
        const next = { ...config, projects: [...config.projects, ...additions] }
        await writeConfig(configPath, next)
        notify(next)
      }),
    remove: name =>
      mutate(async () => {
        const config = await readConfig(configPath)
        const project = config.projects.find(item => item.name === name)
        if (!project) {
          throw new ProjectRegistryError(
            'project_not_found',
            `Project ${name} was not found.`,
            configPath,
          )
        }
        const next = {
          ...config,
          projects: config.projects.filter(item => item.name !== name),
          ignoredProjectPaths: [
            ...new Set([...config.ignoredProjectPaths, project.path]),
          ].toSorted(),
        }
        await writeConfig(configPath, next)
        notify(next)
        return project
      }),
    subscribe: listener => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
