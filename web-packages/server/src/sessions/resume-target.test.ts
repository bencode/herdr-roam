import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { SessionSource } from './catalog.js'
import { sessionResumeTarget } from './resume-target.js'

const directories: string[] = []

const source = async (records: readonly unknown[]): Promise<SessionSource> => {
  const directory = await mkdtemp(join(tmpdir(), 'herdr-roam-resume-target-'))
  directories.push(directory)
  const filePath = join(directory, 'session.jsonl')
  await writeFile(filePath, records.map(record => JSON.stringify(record)).join('\n'))
  return {
    id: 'session-1',
    provider: 'codex',
    title: 'Resume work',
    cwd: '/work/project',
    createdAt: null,
    updatedAt: '2026-09-02T00:00:00.000Z',
    filePath,
  }
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('Session resume target', () => {
  it('uses the latest cwd recorded by a Codex turn', async () => {
    const value = await source([
      { type: 'session_meta', payload: { id: 'session-1', cwd: '/work/project' } },
      { type: 'turn_context', payload: { cwd: '/work/project/.worktrees/first' } },
      { type: 'turn_context', payload: { cwd: '/work/project/.worktrees/latest' } },
    ])

    await expect(sessionResumeTarget(value)).resolves.toMatchObject({
      session: { id: 'session-1', cwd: '/work/project' },
      latestCwd: '/work/project/.worktrees/latest',
    })
  })

  it('falls back to Session metadata when no turn records a cwd', async () => {
    const value = await source([
      { type: 'session_meta', payload: { id: 'session-1', cwd: '/work/project' } },
    ])

    await expect(sessionResumeTarget(value)).resolves.toMatchObject({
      latestCwd: '/work/project',
    })
  })
})
