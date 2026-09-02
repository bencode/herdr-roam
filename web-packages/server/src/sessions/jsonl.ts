import { createReadStream } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { StringDecoder } from 'node:string_decoder'

const asError = (error: unknown): NodeJS.ErrnoException | null =>
  error instanceof Error ? (error as NodeJS.ErrnoException) : null

const isMissing = (error: unknown): boolean => asError(error)?.code === 'ENOENT'

const parseLine = (line: string, path: string, number: number): unknown => {
  try {
    return JSON.parse(line)
  } catch (error) {
    throw new Error(`Invalid JSONL record at ${path}:${number}.`, { cause: error })
  }
}

export async function* readJsonl(
  path: string,
  maxBytes = Number.POSITIVE_INFINITY,
): AsyncGenerator<unknown> {
  const stream = createReadStream(path)
  const decoder = new StringDecoder('utf8')
  let buffer = ''
  let lineNumber = 0
  let bytes = 0

  for await (const chunk of stream) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += value.length
    buffer += decoder.write(value)
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      lineNumber += 1
      if (line.trim()) yield parseLine(line, path, lineNumber)
    }
    if (bytes >= maxBytes) return
  }

  buffer += decoder.end()
  if (!buffer.trim()) return
  try {
    yield parseLine(buffer, path, lineNumber + 1)
  } catch (error) {
    console.warn(`Ignoring an incomplete JSONL tail in ${path}.`, error)
  }
}

export const mapConcurrent = async <Input, Output>(
  values: readonly Input[],
  concurrency: number,
  operation: (value: Input) => Promise<Output>,
): Promise<readonly Output[]> => {
  const output = new Array<Output>(values.length)
  let cursor = 0
  const worker = async (): Promise<void> => {
    while (cursor < values.length) {
      const index = cursor
      cursor += 1
      const value = values[index]
      if (value !== undefined) output[index] = await operation(value)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker))
  return output
}

const collectJsonlFiles = async (directory: string): Promise<readonly string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(entry => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return collectJsonlFiles(path)
      return Promise.resolve(entry.isFile() && entry.name.endsWith('.jsonl') ? [path] : [])
    }),
  )
  return nested.flat()
}

export const jsonlFiles = async (root: string): Promise<readonly string[]> => {
  try {
    return await collectJsonlFiles(root)
  } catch (error) {
    if (isMissing(error)) return []
    throw error
  }
}

export const objectRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null

export const stringValue = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null

export const stringField = (record: Record<string, unknown>, key: string): string | null =>
  stringValue(record[key])

export const booleanField = (record: Record<string, unknown>, key: string): boolean | null =>
  typeof record[key] === 'boolean' ? record[key] : null

export const arrayField = (record: Record<string, unknown>, key: string): readonly unknown[] =>
  Array.isArray(record[key]) ? record[key] : []

export const displayTitle = (text: string | null): string => {
  const compact = text?.replace(/\s+/g, ' ').trim() ?? ''
  if (!compact) return 'Untitled session'
  return compact.length > 96 ? `${compact.slice(0, 95).trimEnd()}…` : compact
}

export const displayValue = (value: unknown): string | null => {
  const text =
    typeof value === 'string'
      ? value
      : value === null || value === undefined
        ? null
        : JSON.stringify(value, null, 2)
  if (!text || text.length <= 2_000) return text
  return `${text.slice(0, 2_000)}\n… [truncated]`
}
