import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProjectRegistry, ProjectRegistryError } from './registry.js'

const execFileAsync = promisify(execFile)
const git = (cwd: string, ...args: readonly string[]) =>
  execFileAsync('git', ['-C', cwd, ...args], { encoding: 'utf8' })

const directories: string[] = []

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'herdr-roam-projects-'))
  directories.push(root)
  return { root, configPath: join(root, 'config', 'config.json') }
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('Project registry', () => {
  it('reads version 1 and writes version 2 with an inferred Project name', async () => {
    const { root, configPath } = await fixture()
    const existingPath = join(root, 'existing')
    const projectPath = join(root, 'Herdr Roam')
    await Promise.all([
      mkdir(existingPath),
      mkdir(projectPath),
      mkdir(dirname(configPath), { recursive: true }),
    ])
    await writeFile(
      configPath,
      JSON.stringify({ version: 1, projects: [{ name: 'existing', path: existingPath }] }),
    )
    const registry = createProjectRegistry(configPath)

    await expect(registry.snapshot()).resolves.toEqual({
      configPath,
      projects: [{ name: 'existing', path: existingPath }],
    })
    await expect(registry.add({ path: projectPath })).resolves.toEqual({
      name: 'herdr-roam',
      path: await realpath(projectPath),
    })
    expect(JSON.parse(await readFile(configPath, 'utf8'))).toEqual({
      version: 2,
      projects: [
        { name: 'existing', path: existingPath },
        { name: 'herdr-roam', path: await realpath(projectPath) },
      ],
      ignoredProjectPaths: [],
    })
  })

  it('deduplicates paths and assigns deterministic suffixes to discovered Projects', async () => {
    const { root, configPath } = await fixture()
    const first = join(root, 'one', 'project')
    const second = join(root, 'two', 'project')
    await Promise.all([mkdir(first, { recursive: true }), mkdir(second, { recursive: true })])
    const [canonicalFirst, canonicalSecond] = await Promise.all([realpath(first), realpath(second)])
    const registry = createProjectRegistry(configPath)

    await registry.discover([second, first, first])
    await expect(registry.snapshot()).resolves.toEqual({
      configPath,
      projects: [
        { name: 'project', path: canonicalFirst },
        { name: 'project-2', path: canonicalSecond },
      ],
    })
    await expect(registry.add({ path: first })).resolves.toEqual({
      name: 'project',
      path: canonicalFirst,
    })
  })

  it('keeps removed Projects ignored until they are manually added again', async () => {
    const { root, configPath } = await fixture()
    const projectPath = join(root, 'project')
    await mkdir(projectPath)
    const canonicalPath = await realpath(projectPath)
    const registry = createProjectRegistry(configPath)
    const listener = vi.fn()
    registry.subscribe(listener)
    await registry.discover([projectPath])

    await expect(registry.remove('project')).resolves.toEqual({
      name: 'project',
      path: canonicalPath,
    })
    await registry.discover([projectPath])
    await expect(registry.snapshot()).resolves.toEqual({ configPath, projects: [] })
    await registry.add({ path: projectPath })
    await expect(registry.snapshot()).resolves.toEqual({
      configPath,
      projects: [{ name: 'project', path: canonicalPath }],
    })
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('deduplicates and ignores Projects by Git repository identity', async () => {
    const { root, configPath } = await fixture()
    const repository = join(root, 'repository')
    const linked = join(root, 'linked')
    await mkdir(repository)
    await git(repository, 'init', '-b', 'main')
    await git(repository, 'config', 'user.email', 'test@example.com')
    await git(repository, 'config', 'user.name', 'Test User')
    await writeFile(join(repository, 'README.md'), '# Fixture\n')
    await git(repository, 'add', 'README.md')
    await git(repository, 'commit', '-m', 'initial')
    await git(repository, 'branch', 'task')
    await git(repository, 'worktree', 'add', linked, 'task')
    const registry = createProjectRegistry(configPath)

    const project = await registry.add({ path: repository })
    await expect(registry.add({ path: linked })).resolves.toEqual(project)
    await expect(registry.snapshot()).resolves.toMatchObject({ projects: [project] })

    await registry.remove(project.name)
    await registry.discover([linked])
    await expect(registry.snapshot()).resolves.toMatchObject({ projects: [] })

    const restored = await registry.add({ path: linked })
    await expect(registry.snapshot()).resolves.toMatchObject({ projects: [restored] })
  })

  it('reports missing Projects and invalid configuration without replacing the file', async () => {
    const { configPath } = await fixture()
    await mkdir(dirname(configPath), { recursive: true })
    const registry = createProjectRegistry(configPath)
    await expect(registry.remove('missing')).rejects.toMatchObject({ code: 'project_not_found' })
    await writeFile(configPath, '{ invalid')

    await expect(registry.snapshot()).rejects.toBeInstanceOf(ProjectRegistryError)
    await expect(registry.snapshot()).rejects.toMatchObject({ code: 'project_config_invalid' })
    expect(await readFile(configPath, 'utf8')).toBe('{ invalid')
  })
})
