import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SkillSource } from '@herdr-roam/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProjectRegistryApi } from '../projects/registry.js'
import { createSkillRoutes } from './routes.js'

const directories: string[] = []

const setup = async () => {
  const root = await mkdtemp(join(tmpdir(), 'herdr-roam-skill-routes-'))
  directories.push(root)
  const project = join(root, 'project')
  const user: Readonly<Record<SkillSource, string>> = {
    agents: join(root, 'user', '.agents', 'skills'),
    codex: join(root, 'user', '.codex', 'skills'),
    claude: join(root, 'user', '.claude', 'skills'),
  }
  await mkdir(join(user.agents, 'shared', 'references'), { recursive: true })
  await writeFile(join(user.agents, 'shared', 'SKILL.md'), '# Shared\n')
  await writeFile(join(user.agents, 'shared', 'references', 'guide.md'), '# Guide\n')
  await mkdir(join(project, '.claude', 'skills', 'project-skill'), { recursive: true })
  await writeFile(join(project, '.claude', 'skills', 'project-skill', 'SKILL.md'), '# Project\n')
  const registry: ProjectRegistryApi = {
    snapshot: vi.fn(),
    get: vi.fn(async name => (name === 'fixture' ? { name, path: project } : null)),
    add: vi.fn(),
    discover: vi.fn(),
    remove: vi.fn(),
    subscribe: vi.fn(),
  }
  return createSkillRoutes(registry, user)
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('Skill routes', () => {
  it('lists Personal and registered Project Skills and reads supporting files', async () => {
    const app = await setup()
    const catalog = await app.request('/?project=fixture')
    const detail = await app.request(`/user/${encodeURIComponent('agents:shared')}`)
    const file = await app.request(
      `/user/${encodeURIComponent('agents:shared')}/files/view?path=references%2Fguide.md`,
    )

    expect(catalog.status).toBe(200)
    await expect(catalog.json()).resolves.toMatchObject({
      items: [{ scope: 'project' }, { scope: 'user' }],
    })
    expect(detail.status).toBe(200)
    await expect(detail.json()).resolves.toMatchObject({
      id: 'agents:shared',
      document: { kind: 'markdown' },
    })
    expect(file.status).toBe(200)
    await expect(file.json()).resolves.toMatchObject({ content: '# Guide\n' })
  })

  it('requires a registered Project and rejects traversal', async () => {
    const app = await setup()
    expect((await app.request('/?project=missing')).status).toBe(404)
    expect(
      (await app.request(`/project/${encodeURIComponent('claude:project-skill')}?project=missing`))
        .status,
    ).toBe(404)
    expect(
      (
        await app.request(
          `/user/${encodeURIComponent('agents:shared')}/files/view?path=..%2Fsecret`,
        )
      ).status,
    ).toBe(400)
  })
})
