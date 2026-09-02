import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  AGENT_PROMPT_IMAGE_MAX_BYTES,
  AGENT_PROMPT_IMAGE_MAX_COUNT,
  type AgentPromptImageType,
} from '@herdr-roam/shared'

type ImageFormat = {
  readonly type: AgentPromptImageType
  readonly extension: 'jpg' | 'png' | 'webp'
  readonly matches: (bytes: Uint8Array) => boolean
}

export type PromptImage = {
  readonly bytes: Uint8Array
  readonly type: AgentPromptImageType
  readonly extension: ImageFormat['extension']
}

export class PromptImageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PromptImageError'
  }
}

const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean =>
  signature.every((value, index) => bytes[index] === value)

const formats: readonly ImageFormat[] = [
  {
    type: 'image/png',
    extension: 'png',
    matches: bytes => startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    type: 'image/jpeg',
    extension: 'jpg',
    matches: bytes => startsWith(bytes, [0xff, 0xd8, 0xff]),
  },
  {
    type: 'image/webp',
    extension: 'webp',
    matches: bytes =>
      startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
      startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50]),
  },
]

const promptImage = async (file: File): Promise<PromptImage> => {
  if (file.size > AGENT_PROMPT_IMAGE_MAX_BYTES) {
    throw new PromptImageError(
      `Each image must be ${AGENT_PROMPT_IMAGE_MAX_BYTES / 1024 / 1024} MiB or smaller.`,
    )
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const format = formats.find(candidate => candidate.matches(bytes))
  if (!format) throw new PromptImageError('Only PNG, JPEG, and WebP images are supported.')
  return { bytes, type: format.type, extension: format.extension }
}

export const readPromptImages = async (files: readonly File[]): Promise<readonly PromptImage[]> => {
  if (files.length > AGENT_PROMPT_IMAGE_MAX_COUNT) {
    throw new PromptImageError(
      `A Prompt can contain at most ${AGENT_PROMPT_IMAGE_MAX_COUNT} images.`,
    )
  }
  return Promise.all(files.map(promptImage))
}

export const stagePromptImages = async (
  images: readonly PromptImage[],
  directory = join(tmpdir(), 'herdr-roam-prompt-images'),
): Promise<readonly string[]> => {
  if (images.length === 0) return []
  await mkdir(directory, { recursive: true, mode: 0o700 })
  return Promise.all(
    images.map(async image => {
      const path = join(directory, `${randomUUID()}.${image.extension}`)
      await writeFile(path, image.bytes, { mode: 0o600 })
      return path
    }),
  )
}
