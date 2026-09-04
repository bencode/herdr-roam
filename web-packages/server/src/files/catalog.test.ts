import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { listProjectDirectory, searchProjectFiles } from './catalog.js'

const directories: string[] = []
const exec = promisify(execFile)

const fixture = async (git: boolean): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'herdr-roam-files-'))
  directories.push(root)
  await mkdir(join(root, 'docs'), { recursive: true })
  await mkdir(join(root, 'node_modules', 'hidden'), { recursive: true })
  await writeFile(join(root, 'README.md'), '# Fixture\n')
  await writeFile(join(root, 'docs', 'guide.md'), '# Guide\n')
  await writeFile(join(root, 'untracked.ts'), 'export {}\n')
  await writeFile(join(root, 'node_modules', 'hidden', 'index.js'), 'hidden\n')
  if (!git) return root
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
  it('uses Git tracked and unignored files with opaque pagination', async () => {
    const root = await fixture(true)
    const first = await listProjectDirectory(root, { limit: 2 })
    const second = await listProjectDirectory(root, {
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    })

    expect([...first.items, ...second.items].map(item => item.path)).toEqual([
      'docs',
      '.gitignore',
      'README.md',
      'untracked.ts',
    ])
    expect(first.nextCursor).not.toBeNull()
  })

  it('searches matching Git paths without returning ignored files', async () => {
    const root = await fixture(true)
    const result = await searchProjectFiles(root, { query: 'guide', limit: 100 })

    expect(result.items).toEqual([{ kind: 'file', name: 'guide.md', path: 'docs/guide.md' }])
  })

  it('falls back to the filesystem while excluding dependency output', async () => {
    const root = await fixture(false)
    const result = await searchProjectFiles(root, { query: 'index', limit: 100 })

    expect(result.items).toEqual([])
  })
})
