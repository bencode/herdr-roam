import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createSessionService, sessionBelongsToProject } from './service.js'

const directories: string[] = []

const createFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'herdr-roam-sessions-'))
  directories.push(root)
  const projectPath = join(root, 'project')
  const nestedPath = join(projectPath, 'packages', 'web')
  const latestPath = join(projectPath, '.worktrees', 'latest')
  const codexRoot = join(root, 'codex')
  const claudeRoot = join(root, 'claude')
  await Promise.all([
    mkdir(nestedPath, { recursive: true }),
    mkdir(latestPath, { recursive: true }),
    mkdir(codexRoot),
    mkdir(claudeRoot),
  ])
  const [canonicalProjectPath, canonicalNestedPath] = await Promise.all([
    realpath(projectPath),
    realpath(nestedPath),
  ])
  await writeFile(
    join(codexRoot, 'codex.jsonl'),
    [
      {
        type: 'session_meta',
        timestamp: '2026-09-01T08:00:00.000Z',
        payload: { id: 'codex-1', cwd: canonicalNestedPath },
      },
      {
        type: 'turn_context',
        payload: { cwd: latestPath },
      },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Codex work' }],
        },
      },
    ]
      .map(value => JSON.stringify(value))
      .join('\n'),
  )
  await writeFile(
    join(codexRoot, 'codex-resumed.jsonl'),
    [
      {
        type: 'session_meta',
        timestamp: '2026-09-01T08:30:00.000Z',
        payload: { id: 'codex-1', cwd: canonicalNestedPath },
      },
      {
        type: 'turn_context',
        payload: { cwd: latestPath },
      },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Codex continuation' }],
        },
      },
    ]
      .map(value => JSON.stringify(value))
      .join('\n'),
  )
  await writeFile(
    join(claudeRoot, 'claude.jsonl'),
    JSON.stringify({
      type: 'user',
      sessionId: 'claude-1',
      cwd: canonicalProjectPath,
      timestamp: '2026-09-01T09:00:00.000Z',
      message: { role: 'user', content: 'Claude work' },
    }),
  )
  return {
    project: { name: 'project', path: canonicalProjectPath },
    roots: { codex: codexRoot, claude: claudeRoot },
    latestPath,
    nestedPath: canonicalNestedPath,
  }
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('Session service', () => {
  it('scopes native Sessions to the registered Project without copying history', async () => {
    const { project, roots, latestPath, nestedPath } = await createFixture()
    const service = createSessionService(roots)

    expect(sessionBelongsToProject(project, nestedPath)).toBe(true)
    expect(sessionBelongsToProject(project, `${project.path}-other`)).toBe(false)
    const catalog = await service.list(project)
    expect(catalog.total).toBe(2)
    expect(catalog.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'codex-1', provider: 'codex' }),
        expect.objectContaining({ id: 'claude-1', provider: 'claude' }),
      ]),
    )
    await expect(service.resumeTarget(project, 'codex', '../invalid')).resolves.toBeNull()
    await expect(service.resumeTarget(project, 'codex', 'codex-1')).resolves.toMatchObject({
      session: { title: 'Codex continuation' },
      latestCwd: latestPath,
    })
    await expect(service.resumeTarget(project, 'claude', 'claude-1')).resolves.toMatchObject({
      session: { title: 'Claude work' },
      latestCwd: project.path,
    })
    await expect(service.page(project, 'claude', 'claude-1')).resolves.toMatchObject({
      mode: 'page',
      entries: [expect.objectContaining({ kind: 'message', text: 'Claude work' })],
    })
  })

  it('pages and searches Project Sessions without persisting a catalog', async () => {
    const { project, roots } = await createFixture()
    const service = createSessionService(roots)

    const first = await service.list(project, { limit: 1 })
    expect(first).toMatchObject({ total: 2, items: [expect.any(Object)] })
    expect(first.nextCursor).toEqual(expect.any(String))

    const second = await service.list(project, { limit: 1, cursor: first.nextCursor ?? undefined })
    expect(second).toMatchObject({ total: 2, nextCursor: null })
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id)

    await expect(service.list(project, { query: 'Claude' })).resolves.toMatchObject({
      total: 1,
      items: [expect.objectContaining({ id: 'claude-1' })],
    })
  })
})
