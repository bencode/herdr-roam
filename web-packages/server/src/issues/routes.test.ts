import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectRegistryApi } from '../projects/registry.js'
import { createIssueRoutes } from './routes.js'

const directories: string[] = []
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const setup = async () => {
  const path = await mkdtemp(join(tmpdir(), 'herdr-roam-issue-routes-'))
  directories.push(path)
  await mkdir(join(path, 'docs', 'issues'), { recursive: true })
  await writeFile(
    join(path, '.herdr-roam.json'),
    `${JSON.stringify({ version: 1, issues: { directory: 'docs/issues' } })}\n`,
  )
  await writeFile(
    join(path, 'docs', 'issues', `${id}.md`),
    `---\nid: ${id}\ntitle: Release\nstatus: open\n---\n- [ ] Verify release\n`,
  )
  const registry: ProjectRegistryApi = {
    snapshot: vi.fn(),
    get: vi.fn(async name => (name === 'fixture' ? { name, path } : null)),
    add: vi.fn(),
    discover: vi.fn(),
    remove: vi.fn(),
    subscribe: vi.fn(),
  }
  return createIssueRoutes(registry)
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('Issue routes', () => {
  it('lists and reads Issues from the selected Workspace', async () => {
    const app = await setup()
    const catalog = await app.request('/fixture/workspaces/primary/issues')
    const detail = await app.request(`/fixture/workspaces/primary/issues/${id}`)

    expect(catalog.status).toBe(200)
    await expect(catalog.json()).resolves.toMatchObject({ items: [{ id, title: 'Release' }] })
    expect(detail.status).toBe(200)
    await expect(detail.json()).resolves.toMatchObject({ id, body: '- [ ] Verify release\n' })
  })

  it('returns explicit missing Project and Issue errors', async () => {
    const app = await setup()
    const missingProject = await app.request('/missing/workspaces/primary/issues')
    const missingIssue = await app.request(
      '/fixture/workspaces/primary/issues/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    )

    expect(missingProject.status).toBe(404)
    await expect(missingProject.json()).resolves.toMatchObject({
      error: { code: 'project_not_found' },
    })
    expect(missingIssue.status).toBe(404)
    await expect(missingIssue.json()).resolves.toMatchObject({ error: { code: 'issue_not_found' } })
  })
})
