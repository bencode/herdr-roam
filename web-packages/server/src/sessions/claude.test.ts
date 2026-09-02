import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  discoverClaudeSessionIdentities,
  readClaudeSessionRange,
  summarizeClaudeSession,
} from './claude.js'

const directories: string[] = []

const fixture = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'herdr-roam-claude-'))
  directories.push(root)
  const path = join(root, 'claude-session.jsonl')
  const base = {
    sessionId: 'claude-session',
    cwd: '/work/project',
    isSidechain: false,
  }
  const records = [
    {
      ...base,
      type: 'user',
      uuid: 'message-1',
      timestamp: '2026-09-01T08:00:00.000Z',
      message: { role: 'user', content: 'Review the release' },
    },
    {
      ...base,
      type: 'assistant',
      uuid: 'message-2',
      timestamp: '2026-09-01T08:00:01.000Z',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'I will inspect it.' },
          { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: 'README.md' } },
        ],
      },
    },
    {
      ...base,
      type: 'user',
      uuid: 'message-3',
      timestamp: '2026-09-01T08:00:02.000Z',
      message: {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'tool-1', content: 'contents' }],
      },
    },
  ]
  await writeFile(path, records.map(record => JSON.stringify(record)).join('\n'))
  return root
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('Claude Session history', () => {
  it('discovers metadata and joins tool results to their activities', async () => {
    const sessions = await discoverClaudeSessionIdentities(await fixture())

    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      id: 'claude-session',
      provider: 'claude',
      cwd: '/work/project',
    })
    const session = sessions[0]
    if (!session) throw new Error('Claude Session fixture was not discovered.')
    const source = await summarizeClaudeSession(session)
    expect(source).toMatchObject({ title: 'Review the release' })
    const range = await readClaudeSessionRange(source, {})
    expect(range.entries.map(value => value.entry)).toMatchObject([
      { kind: 'message', role: 'user', text: 'Review the release' },
      { kind: 'message', role: 'assistant', text: 'I will inspect it.' },
      {
        kind: 'activity',
        id: 'tool-1',
        name: 'Read',
        status: 'completed',
        output: 'contents',
      },
    ])
  })
})
