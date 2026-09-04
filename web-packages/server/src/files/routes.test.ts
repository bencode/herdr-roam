import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectRegistryApi } from '../projects/registry.js'
import { createFileRoutes } from './routes.js'

const directories: string[] = []

const routes = async () => {
  const path = await mkdtemp(join(tmpdir(), 'herdr-roam-file-routes-'))
  directories.push(path)
  await writeFile(join(path, 'README.md'), '# Route fixture\n')
  const registry: ProjectRegistryApi = {
    snapshot: vi.fn(),
    get: vi.fn(async name => (name === 'fixture' ? { name, path } : null)),
    add: vi.fn(),
    discover: vi.fn(),
    remove: vi.fn(),
    subscribe: vi.fn(),
  }
  return createFileRoutes(registry)
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('Project file routes', () => {
  it('lists and reads registered Project files', async () => {
    const app = await routes()
    const catalog = await app.request('/fixture/workspaces/primary/files')
    const view = await app.request('/fixture/workspaces/primary/files/view?path=README.md')

    expect(catalog.status).toBe(200)
    await expect(catalog.json()).resolves.toMatchObject({
      items: [{ kind: 'file', path: 'README.md' }],
    })
    expect(view.status).toBe(200)
    await expect(view.json()).resolves.toMatchObject({
      kind: 'markdown',
      content: '# Route fixture\n',
    })
  })

  it('streams supported assets with restrictive response headers', async () => {
    const app = await routes()
    const root = directories.at(-1) ?? ''
    await mkdir(join(root, 'assets'))
    await writeFile(
      join(root, 'assets', 'mark.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    )
    const response = await app.request('/fixture/workspaces/primary/files/raw/assets/mark.svg')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('image/svg+xml')
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'")
  })

  it('returns explicit errors for missing Projects and invalid paths', async () => {
    const app = await routes()
    expect((await app.request('/missing/workspaces/primary/files')).status).toBe(404)
    expect(
      (await app.request('/fixture/workspaces/primary/files/view?path=../secret')).status,
    ).toBe(400)
  })
})
