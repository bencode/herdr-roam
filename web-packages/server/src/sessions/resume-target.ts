import type { SessionSummary } from '@herdr-roam/shared'
import type { SessionSource } from './catalog.js'
import { objectRecord, stringField } from './jsonl.js'
import { readJsonlBackwardRange } from './jsonl-range.js'

export type SessionResumeTarget = {
  readonly session: SessionSummary
  readonly latestCwd: string
}

const recordedCwd = (value: unknown): string | null => {
  const record = objectRecord(value)
  if (!record || stringField(record, 'type') !== 'turn_context') return null
  const payload = objectRecord(record.payload)
  return payload ? stringField(payload, 'cwd') : null
}

const readLatestCodexCwd = async (source: SessionSource): Promise<string> => {
  let before: number | undefined
  while (true) {
    const range = await readJsonlBackwardRange(source.filePath, before)
    const cwd = range.records
      .toReversed()
      .map(record => recordedCwd(record.value))
      .find((value): value is string => value !== null)
    if (cwd) return cwd
    if (range.start === 0) return source.cwd
    before = range.start
  }
}

const sourceSummary = ({ filePath: _filePath, ...summary }: SessionSource): SessionSummary =>
  summary

export const sessionResumeTarget = async (source: SessionSource): Promise<SessionResumeTarget> => ({
  session: sourceSummary(source),
  latestCwd: source.provider === 'codex' ? await readLatestCodexCwd(source) : source.cwd,
})
