import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { listSkillDirectory, readSkillFile } from './content.js'
import type { SkillError } from './identity.js'

const directories: string[] = []

const fixture = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'herdr-roam-skill-content-'))
  directories.push(root)
  await mkdir(join(root, 'references'))
  await writeFile(join(root, 'SKILL.md'), '# Fixture\n')
  await writeFile(join(root, 'references', 'guide.md'), '# Guide\n')
  await writeFile(join(root, 'script.ts'), 'export const value = 1\n')
  return root
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('Skill supporting files', () => {
  it('omits the Overview document and paginates directories before files', async () => {
    const root = await fixture()
    const first = await listSkillDirectory(root, { limit: 1 })
    const second = await listSkillDirectory(root, {
      limit: 1,
      cursor: first.nextCursor ?? undefined,
    })

    expect(first).toMatchObject({
      items: [{ kind: 'directory', path: 'references' }],
      total: 2,
    })
    expect(second.items).toEqual([{ kind: 'file', name: 'script.ts', path: 'script.ts' }])
  })

  it('reads files inside the Skill and rejects linked entries that escape its root', async () => {
    const root = await fixture()
    const outside = await temporaryOutside()
    await symlink(join(outside, 'secret.md'), join(root, 'secret.md'))

    await expect(readSkillFile(root, 'references/guide.md')).resolves.toMatchObject({
      kind: 'markdown',
      content: '# Guide\n',
    })
    await expect(readSkillFile(root, 'secret.md')).rejects.toMatchObject<Partial<SkillError>>({
      code: 'invalid_path',
    })
  })
})

const temporaryOutside = async (): Promise<string> => {
  const path = await mkdtemp(join(tmpdir(), 'herdr-roam-skill-outside-'))
  directories.push(path)
  await writeFile(join(path, 'secret.md'), 'secret\n')
  return path
}
