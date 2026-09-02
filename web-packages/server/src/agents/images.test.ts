import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AGENT_PROMPT_IMAGE_MAX_BYTES, AGENT_PROMPT_IMAGE_MAX_COUNT } from '@herdr-roam/shared'
import { afterEach, describe, expect, it } from 'vitest'
import { PromptImageError, readPromptImages, stagePromptImages } from './images.js'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
let testDirectory: string | null = null

afterEach(async () => {
  if (testDirectory) await rm(testDirectory, { recursive: true, force: true })
  testDirectory = null
})

describe('Prompt images', () => {
  it('detects the image signature and stages a private temporary file', async () => {
    testDirectory = await mkdtemp(join(tmpdir(), 'herdr-roam-images-test-'))
    const images = await readPromptImages([new File([png], 'spoofed.jpg', { type: 'image/jpeg' })])
    const [path] = await stagePromptImages(images, join(testDirectory, 'images'))

    expect(images[0]).toMatchObject({ type: 'image/png', extension: 'png' })
    await expect(readFile(path ?? '')).resolves.toEqual(Buffer.from(png))
    expect((await stat(path ?? '')).mode & 0o777).toBe(0o600)
  })

  it('rejects unsupported bytes before writing a file', async () => {
    const read = readPromptImages([
      new File([new Uint8Array([0x00, 0x01])], 'not-an-image.png', { type: 'image/png' }),
    ])
    await expect(read).rejects.toBeInstanceOf(PromptImageError)
  })

  it('rejects too many images before reading them', async () => {
    const files = Array.from(
      { length: AGENT_PROMPT_IMAGE_MAX_COUNT + 1 },
      (_, index) => new File([png], `${index}.png`, { type: 'image/png' }),
    )

    await expect(readPromptImages(files)).rejects.toThrow(
      `at most ${AGENT_PROMPT_IMAGE_MAX_COUNT} images`,
    )
  })

  it('rejects an image larger than the per-file limit', async () => {
    const oversized = new File(
      [png, new Uint8Array(AGENT_PROMPT_IMAGE_MAX_BYTES)],
      'oversized.png',
      { type: 'image/png' },
    )

    await expect(readPromptImages([oversized])).rejects.toThrow('MiB or smaller')
  })
})
