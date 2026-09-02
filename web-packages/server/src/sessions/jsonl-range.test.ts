import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  readJsonlBackwardRange,
  readJsonlForwardRange,
  SESSION_HISTORY_MAX_RECORD_BYTES,
} from './jsonl-range.js'

const directories: string[] = []

const fixture = async (content: string): Promise<string> => {
  const directory = await mkdtemp(join(tmpdir(), 'herdr-roam-jsonl-range-'))
  directories.push(directory)
  const path = join(directory, 'session.jsonl')
  await writeFile(path, content)
  return path
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('JSONL byte ranges', () => {
  it('returns complete UTF-8 records and leaves an incomplete tail for the next read', async () => {
    const first = `${JSON.stringify({ text: '中文' })}\n`
    const second = '{"text":"later"'
    const path = await fixture(`${first}${second}`)

    const latest = await readJsonlBackwardRange(path)
    expect(latest.records.map(record => record.value)).toEqual([{ text: '中文' }])
    expect(latest.end).toBe(Buffer.byteLength(first))

    await writeFile(path, `${first}${second}}\n`)
    const delta = await readJsonlForwardRange(path, latest.end)
    expect(delta.records.map(record => record.value)).toEqual([{ text: 'later' }])
    expect(delta.caughtUp).toBe(true)
  })

  it('represents an oversized native record without parsing or retaining its content', async () => {
    const path = await fixture(`${'x'.repeat(SESSION_HISTORY_MAX_RECORD_BYTES + 1)}\n`)
    const page = await readJsonlBackwardRange(path)

    expect(page.records).toEqual([
      expect.objectContaining({ omitted: true, bytes: SESSION_HISTORY_MAX_RECORD_BYTES + 1 }),
    ])
  })

  it('skips a continued oversized record before parsing later complete records', async () => {
    const oversized = 'x'.repeat(SESSION_HISTORY_MAX_RECORD_BYTES + 128)
    const path = await fixture(`${oversized}\n${JSON.stringify({ text: 'after' })}\n`)
    const range = await readJsonlForwardRange(path, 256)

    expect(range.records).toEqual([
      expect.objectContaining({ omitted: true }),
      expect.objectContaining({ value: { text: 'after' }, omitted: false }),
    ])
    expect(range.caughtUp).toBe(true)
  })
})
