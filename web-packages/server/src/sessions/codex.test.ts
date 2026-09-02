import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  discoverCodexSessionIdentities,
  readCodexSessionRange,
  summarizeCodexSession,
} from './codex.js'

const directories: string[] = []

const fixture = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'herdr-roam-codex-'))
  directories.push(root)
  const directory = join(root, '2026', '09', '01')
  await mkdir(directory, { recursive: true })
  const path = join(directory, 'rollout.jsonl')
  const records = [
    {
      timestamp: '2026-09-01T08:00:00.000Z',
      type: 'session_meta',
      payload: { id: 'codex-session', cwd: '/work/project' },
    },
    {
      timestamp: '2026-09-01T08:00:01.000Z',
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: '# AGENTS.md instructions\nInternal context' }],
      },
    },
    {
      timestamp: '2026-09-01T08:00:01.500Z',
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'user',
        content: [
          { type: 'input_text', text: 'Review the release' },
          { type: 'input_image', path: '/tmp/screen.png' },
        ],
      },
    },
    {
      timestamp: '2026-09-01T08:00:02.000Z',
      type: 'response_item',
      payload: { type: 'function_call', call_id: 'call-1', name: 'read_file', arguments: '{}' },
    },
    {
      timestamp: '2026-09-01T08:00:03.000Z',
      type: 'response_item',
      payload: { type: 'function_call_output', call_id: 'call-1', output: 'done' },
    },
    {
      timestamp: '2026-09-01T08:00:04.000Z',
      type: 'response_item',
      payload: {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Ready.' }],
      },
    },
  ]
  await writeFile(path, records.map(record => JSON.stringify(record)).join('\n'))
  await writeFile(
    join(directory, 'subagent.jsonl'),
    JSON.stringify({
      timestamp: '2026-09-01T08:00:00.000Z',
      type: 'session_meta',
      payload: {
        id: 'internal-review',
        cwd: '/work/project',
        source: { subagent: { other: 'guardian' } },
      },
    }),
  )
  return root
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('Codex Session history', () => {
  it('discovers metadata and reconstructs messages, images, and activities', async () => {
    const sessions = await discoverCodexSessionIdentities(await fixture())

    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      id: 'codex-session',
      provider: 'codex',
      cwd: '/work/project',
    })
    const session = sessions[0]
    if (!session) throw new Error('Codex Session fixture was not discovered.')
    const source = await summarizeCodexSession(session)
    expect(source).toMatchObject({ title: 'Review the release' })
    const range = await readCodexSessionRange(source, {})
    expect(range.entries.map(value => value.entry)).toMatchObject([
      {
        kind: 'message',
        role: 'user',
        text: 'Review the release',
        attachments: [{ kind: 'image', name: 'screen.png' }],
      },
      {
        kind: 'activity',
        id: 'call-1',
        name: 'read_file',
        status: 'completed',
        input: '{}',
        output: 'done',
      },
      { kind: 'message', role: 'assistant', text: 'Ready.' },
    ])
  })
})
