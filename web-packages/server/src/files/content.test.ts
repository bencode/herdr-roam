import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { PROJECT_TEXT_MAX_BYTES, readProjectFile, readRawProjectFile } from './content.js'

const directories: string[] = []

const fixture = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'herdr-roam-content-'))
  directories.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('Project file content', () => {
  it('classifies readable text, Markdown, valid images, and binary content', async () => {
    const root = await fixture()
    await writeFile(join(root, 'README.md'), '# Hello\n')
    await writeFile(join(root, 'notes'), 'plain text\n')
    await writeFile(
      join(root, 'image.png'),
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
    await writeFile(join(root, 'binary.dat'), Buffer.from([0x00, 0xff]))

    await expect(readProjectFile(root, 'README.md')).resolves.toMatchObject({ kind: 'markdown' })
    await expect(readProjectFile(root, 'notes')).resolves.toMatchObject({ kind: 'text' })
    await expect(readProjectFile(root, 'image.png')).resolves.toMatchObject({ kind: 'image' })
    await expect(readProjectFile(root, 'binary.dat')).resolves.toMatchObject({ kind: 'binary' })
  })

  it('rejects spoofed raw images and paths escaping through symlinks', async () => {
    const root = await fixture()
    const outside = await fixture()
    await writeFile(join(root, 'spoofed.png'), 'not a png')
    await writeFile(join(outside, 'secret.txt'), 'secret')
    await symlink(join(outside, 'secret.txt'), join(root, 'secret.txt'))

    await expect(readRawProjectFile(root, 'spoofed.png')).rejects.toMatchObject({
      code: 'file_unsupported',
    })
    await expect(readProjectFile(root, 'secret.txt')).rejects.toMatchObject({
      code: 'invalid_path',
    })
  })

  it('returns metadata instead of reading oversized text', async () => {
    const root = await fixture()
    await writeFile(join(root, 'large.txt'), Buffer.alloc(PROJECT_TEXT_MAX_BYTES + 1, 0x61))

    await expect(readProjectFile(root, 'large.txt')).resolves.toMatchObject({
      kind: 'oversized',
      previewKind: 'text',
      limit: PROJECT_TEXT_MAX_BYTES,
    })
  })
})
