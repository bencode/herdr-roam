import { open, stat } from 'node:fs/promises'
import type { SessionActivityUpdate, SessionEntry } from '@herdr-roam/shared'

export const SESSION_HISTORY_MAX_SCAN_BYTES = 32 * 1024 * 1024
export const SESSION_HISTORY_MAX_RECORD_BYTES = 4 * 1024 * 1024
export const SESSION_HISTORY_MAX_CONTENT_BYTES = 512 * 1024
export const SESSION_HISTORY_MAX_ENTRIES = 200

export type JsonlRangeRecord = {
  readonly value: unknown | null
  readonly start: number
  readonly end: number
  readonly bytes: number
  readonly omitted: boolean
}

export type JsonlRange = {
  readonly records: readonly JsonlRangeRecord[]
  readonly start: number
  readonly end: number
  readonly fileSize: number
  readonly caughtUp: boolean
}

export type PositionedSessionEntry = {
  readonly offset: number
  readonly entry: SessionEntry
}

export type ProviderRangeContent = Pick<JsonlRange, 'start' | 'end' | 'fileSize' | 'caughtUp'> & {
  readonly entries: readonly PositionedSessionEntry[]
  readonly activityUpdates: readonly SessionActivityUpdate[]
}

const parseRecord = (buffer: Buffer, start: number, end: number): JsonlRangeRecord | null => {
  const bytes = buffer.length
  if (bytes === 0) return null
  if (bytes > SESSION_HISTORY_MAX_RECORD_BYTES) {
    return { value: null, start, end, bytes, omitted: true }
  }
  try {
    return { value: JSON.parse(buffer.toString('utf8')), start, end, bytes, omitted: false }
  } catch (error) {
    throw new Error(`Invalid JSONL record at byte ${start}.`, { cause: error })
  }
}

const recordsFromBuffer = (
  buffer: Buffer,
  absoluteStart: number,
  includeFinalRecord: boolean,
): readonly JsonlRangeRecord[] => {
  const records: JsonlRangeRecord[] = []
  let lineStart = 0
  let newline = buffer.indexOf(10, lineStart)
  while (newline >= 0) {
    const record = parseRecord(
      buffer.subarray(lineStart, newline),
      absoluteStart + lineStart,
      absoluteStart + newline + 1,
    )
    if (record) records.push(record)
    lineStart = newline + 1
    newline = buffer.indexOf(10, lineStart)
  }
  if (includeFinalRecord && lineStart < buffer.length) {
    const record = parseRecord(
      buffer.subarray(lineStart),
      absoluteStart + lineStart,
      absoluteStart + buffer.length,
    )
    if (record) records.push(record)
  }
  return records
}

const readBytes = async (path: string, start: number, end: number): Promise<Buffer> => {
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.allocUnsafe(Math.max(0, end - start))
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, start)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

const firstCompleteRecord = (buffer: Buffer, requestedStart: number): number => {
  if (requestedStart === 0) return 0
  const newline = buffer.indexOf(10)
  return newline < 0 ? buffer.length : newline + 1
}

const lastCompleteRecord = (buffer: Buffer, reachesFileEnd: boolean): number => {
  if (buffer.length === 0 || buffer.at(-1) === 10) return buffer.length
  const newline = buffer.lastIndexOf(10)
  if (!reachesFileEnd) return newline < 0 ? 0 : newline + 1
  const tailStart = newline < 0 ? 0 : newline + 1
  const tail = buffer.subarray(tailStart)
  if (tail.length > SESSION_HISTORY_MAX_RECORD_BYTES) return tailStart
  try {
    JSON.parse(tail.toString('utf8'))
    return buffer.length
  } catch {
    return tailStart
  }
}

export const readJsonlBackwardRange = async (
  path: string,
  before?: number,
): Promise<JsonlRange> => {
  const fileSize = (await stat(path)).size
  const requestedEnd = Math.min(before ?? fileSize, fileSize)
  const requestedStart = Math.max(0, requestedEnd - SESSION_HISTORY_MAX_SCAN_BYTES)
  const buffer = await readBytes(path, requestedStart, requestedEnd)
  const head = firstCompleteRecord(buffer, requestedStart)
  const tail = lastCompleteRecord(buffer, requestedEnd === fileSize)
  const recordStart = requestedStart + head
  const end = requestedStart + Math.max(head, tail)
  const complete = tail > head
  const oversizedChunk =
    !complete &&
    buffer.length > 0 &&
    (requestedStart > 0 || buffer.length > SESSION_HISTORY_MAX_RECORD_BYTES)
  return {
    records: oversizedChunk
      ? [
          {
            value: null,
            start: requestedStart,
            end: requestedEnd,
            bytes: buffer.length,
            omitted: true,
          },
        ]
      : recordsFromBuffer(
          buffer.subarray(head, tail),
          recordStart,
          complete && buffer.at(tail - 1) !== 10,
        ),
    start: oversizedChunk ? requestedStart : recordStart,
    end: oversizedChunk ? requestedEnd : end,
    fileSize,
    caughtUp: end >= fileSize,
  }
}

export const readJsonlForwardRange = async (path: string, after: number): Promise<JsonlRange> => {
  const fileSize = (await stat(path)).size
  if (after > fileSize) throw new RangeError('The JSONL cursor is past the end of the file.')
  const requestedEnd = Math.min(fileSize, after + SESSION_HISTORY_MAX_SCAN_BYTES)
  const buffer = await readBytes(path, after, requestedEnd)
  const previous = after > 0 ? await readBytes(path, after - 1, after) : null
  const aligned = after === 0 || previous?.at(0) === 10
  const nextNewline = aligned ? -1 : buffer.indexOf(10)
  const prefixEnd = aligned ? 0 : nextNewline < 0 ? buffer.length : nextNewline + 1
  const body = buffer.subarray(prefixEnd)
  const tail = lastCompleteRecord(body, requestedEnd === fileSize)
  const oversizedChunk =
    tail === 0 &&
    body.length > 0 &&
    (requestedEnd < fileSize || body.length > SESSION_HISTORY_MAX_RECORD_BYTES)
  const end = oversizedChunk ? requestedEnd : after + prefixEnd + tail
  const continuedRecord: readonly JsonlRangeRecord[] =
    prefixEnd > 0
      ? [
          {
            value: null,
            start: after,
            end: after + prefixEnd,
            bytes: prefixEnd,
            omitted: true,
          },
        ]
      : []
  return {
    records: oversizedChunk
      ? [
          ...continuedRecord,
          {
            value: null,
            start: after + prefixEnd,
            end: requestedEnd,
            bytes: body.length,
            omitted: true,
          },
        ]
      : [
          ...continuedRecord,
          ...recordsFromBuffer(
            body.subarray(0, tail),
            after + prefixEnd,
            tail > 0 && body.at(tail - 1) !== 10,
          ),
        ],
    start: after,
    end,
    fileSize,
    caughtUp: end >= fileSize,
  }
}
