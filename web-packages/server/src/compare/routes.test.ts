import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, expect, it, vi } from 'vitest'
import type { ProjectRegistryApi } from '../projects/registry.js'
import { createCompareRoutes } from './routes.js'

const directories: string[] = []
const exec = promisify(execFile)
afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

it('serves project-scoped branch comparisons, validates inputs and limits reads to changed files', async () => {
  const path = await mkdtemp(join(tmpdir(), 'roam-compare-routes-'))
  directories.push(path)
  const git = (...args: string[]) => exec('git', ['-C', path, ...args])
  await git('init', '-b', 'main')
  await git('config', 'user.name', 'Fixture')
  await git('config', 'user.email', 'fixture@example.test')
  await writeFile(join(path, 'same.txt'), 'same\n')
  await git('add', '.')
  await git('commit', '-m', 'base')
  await git('checkout', '-b', 'feature')
  await writeFile(join(path, '中文 + &.txt'), 'new\n')
  await git('add', '.')
  await git('commit', '-m', 'source')
  const registry: ProjectRegistryApi = {
    get: vi.fn(async name => (name === 'fixture' ? { name, path } : null)),
    snapshot: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    discover: vi.fn(),
    subscribe: vi.fn(),
  }
  const app = createCompareRoutes(registry)
  expect((await app.request('/fixture/branches')).status).toBe(200)
  expect((await app.request('/missing/branches')).status).toBe(404)
  expect((await app.request('/fixture/compare')).status).toBe(400)
  expect((await app.request('/fixture/compare?sourceRef=HEAD&targetRef=main')).status).toBe(404)
  const response = await app.request(
    `/fixture/compare?${new URLSearchParams({ sourceRef: 'refs/heads/feature', targetRef: 'refs/heads/main' })}`,
  )
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  const result = (await response.json()) as {
    baseOid: string
    source: { oid: string }
    files: unknown[]
  }
  expect(result.files).toEqual([expect.objectContaining({ oldMode: null, newMode: '100644' })])
  const query = (filePath: string) =>
    new URLSearchParams({ baseOid: result.baseOid, sourceOid: result.source.oid, path: filePath })
  const content = await app.request(`/fixture/compare/file?${query('中文 + &.txt')}`)
  expect(content.status).toBe(200)
  await expect(content.json()).resolves.toMatchObject({
    kind: 'text',
    entry: { oldMode: null, newMode: '100644' },
    oldFile: null,
    newFile: { content: 'new\n' },
  })
  expect((await app.request(`/fixture/compare/file?${query('same.txt')}`)).status).toBe(404)
  expect((await app.request(`/fixture/compare/file?${query('../same.txt')}`)).status).toBe(400)
  const missing = await mkdtemp(join(tmpdir(), 'roam-not-git-'))
  directories.push(missing)
  vi.mocked(registry.get).mockResolvedValue({ name: 'plain', path: missing })
  expect((await app.request('/plain/branches')).status).toBe(409)
})
