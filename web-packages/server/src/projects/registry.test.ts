import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { createProjectRegistry, ProjectRegistryError } from './registry.js'

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
  it('creates a versioned config and restores its ordered Projects', async () => {
    const { root, configPath } = await fixture()
    const projectPath = join(root, 'project')
    await mkdir(projectPath)
    const canonicalPath = await realpath(projectPath)
    const registry = createProjectRegistry(configPath)

    await expect(registry.snapshot()).resolves.toEqual({ configPath, projects: [] })
    await expect(registry.add({ name: 'herdr-roam', path: projectPath })).resolves.toEqual({
      name: 'herdr-roam',
      path: canonicalPath,
    })
    await expect(createProjectRegistry(configPath).snapshot()).resolves.toEqual({
      configPath,
      projects: [{ name: 'herdr-roam', path: canonicalPath }],
    })
    expect(await readFile(configPath, 'utf8')).toBe(
      `${JSON.stringify(
        { version: 1, projects: [{ name: 'herdr-roam', path: canonicalPath }] },
        null,
        2,
      )}\n`,
    )
  })

  it('rejects duplicate names and canonical paths', async () => {
    const { root, configPath } = await fixture()
    const projectPath = join(root, 'project')
    await mkdir(projectPath)
    const registry = createProjectRegistry(configPath)
    await registry.add({ name: 'first', path: projectPath })

    await expect(registry.add({ name: 'first', path: root })).rejects.toMatchObject({
      code: 'project_name_taken',
    })
    await expect(registry.add({ name: 'second', path: projectPath })).rejects.toMatchObject({
      code: 'project_path_taken',
    })
  })

  it('reports invalid configuration without replacing it', async () => {
    const { configPath } = await fixture()
    await mkdir(dirname(configPath), { recursive: true })
    await writeFile(configPath, '{ invalid')
    const registry = createProjectRegistry(configPath)

    await expect(registry.snapshot()).rejects.toBeInstanceOf(ProjectRegistryError)
    await expect(registry.snapshot()).rejects.toMatchObject({ code: 'project_config_invalid' })
    expect(await readFile(configPath, 'utf8')).toBe('{ invalid')
  })
})
