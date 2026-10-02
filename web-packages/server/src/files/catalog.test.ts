import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { listProjectDirectory, searchProjectFiles } from './catalog.js'

const directories: string[] = []
const exec = promisify(execFile)

const fixture = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'herdr-roam-files-'))
  directories.push(root)
  await mkdir(join(root, 'docs'), { recursive: true })
  await mkdir(join(root, 'node_modules', 'hidden'), { recursive: true })
  await writeFile(join(root, 'README.md'), '# Fixture\n')
  await writeFile(join(root, 'docs', 'guide.md'), '# Guide\n')
  await writeFile(join(root, 'untracked.ts'), 'export {}\n')
  await writeFile(join(root, 'node_modules', 'hidden', 'index.js'), 'hidden\n')
  await exec('git', ['-C', root, 'init', '--quiet'])
  await writeFile(join(root, '.gitignore'), 'node_modules/\nignored.txt\n')
  await writeFile(join(root, 'ignored.txt'), 'ignored\n')
  await exec('git', ['-C', root, 'add', 'README.md', 'docs/guide.md', '.gitignore'])
  return root
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('Project file catalog', () => {
  it('lists every directory entry, including Git internals and ignored files, with opaque pagination', async () => {
    const root = await fixture()
    const first = await listProjectDirectory(root, { limit: 2 })
    const second = await listProjectDirectory(root, {
      limit: 5,
      cursor: first.nextCursor ?? undefined,
    })

    expect([...first.items, ...second.items].map(item => item.path)).toEqual([
      '.git',
      'docs',
      'node_modules',
      '.gitignore',
      'ignored.txt',
      'README.md',
      'untracked.ts',
    ])
    expect(first.nextCursor).not.toBeNull()
  })

  it('searches every file, including ignored and dependency files', async () => {
    const root = await fixture()
    const matches = await searchProjectFiles(root, 'i', new AbortController().signal)
    const paths = (await Array.fromAsync(matches)).map(item => item.path)

    expect(paths).toEqual(expect.arrayContaining(['ignored.txt', 'node_modules/hidden/index.js']))
  })
})
