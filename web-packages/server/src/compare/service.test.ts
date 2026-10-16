import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { createComparison, listCompareBranches, readComparisonFile } from './service.js'

const exec = promisify(execFile)
const directories: string[] = []
const setup = async () => {
  const path = await mkdtemp(join(tmpdir(), 'roam-compare-'))
  directories.push(path)
  const git = async (...args: string[]) => (await exec('git', ['-C', path, ...args])).stdout.trim()
  await git('init', '-b', 'main')
  await git('config', 'user.name', 'Fixture')
  await git('config', 'user.email', 'fixture@example.test')
  await writeFile(join(path, 'base.txt'), 'base\n')
  await writeFile(join(path, 'rename.txt'), 'unchanged rename\n')
  await git('add', '.')
  await git('commit', '-m', 'base')
  const baseOid = await git('rev-parse', 'HEAD')
  await git('checkout', '-b', 'feature')
  const commit = async () => {
    await git('add', '.')
    await git('commit', '-m', 'change')
  }
  return { project: { name: 'fixture', path }, path, git, commit, baseOid }
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('committed branch comparisons', () => {
  it('compares from the merge base and freezes content even when refs advance', async () => {
    const fixture = await setup()
    await writeFile(join(fixture.path, 'base.txt'), 'source change\n')
    await fixture.commit()
    await fixture.git('checkout', 'main')
    await writeFile(join(fixture.path, 'target.txt'), 'only on target\n')
    await fixture.commit()
    await fixture.git('checkout', 'feature')
    await writeFile(join(fixture.path, 'staged.txt'), 'staged\n')
    await fixture.git('add', 'staged.txt')
    await writeFile(join(fixture.path, 'base.txt'), 'uncommitted\n')
    const result = await createComparison(fixture.project, 'refs/heads/feature', 'refs/heads/main')
    expect(result.baseOid).toBe(fixture.baseOid)
    expect(result.files).toEqual([
      {
        oldPath: 'base.txt',
        newPath: 'base.txt',
        oldMode: '100644',
        newMode: '100644',
        status: 'modified',
        added: 1,
        removed: 1,
      },
    ])
    await writeFile(join(fixture.path, 'base.txt'), 'later source commit\n')
    await fixture.commit()
    await expect(
      readComparisonFile(fixture.project, result.baseOid, result.source.oid, 'base.txt'),
    ).resolves.toMatchObject({
      kind: 'text',
      oldFile: { content: 'base\n' },
      newFile: { content: 'source change\n' },
    })
  })

  it('reads additions, deletions, renames, empty files, literal special paths, and symlink blobs', async () => {
    const fixture = await setup()
    await rm(join(fixture.path, 'base.txt'))
    await rename(join(fixture.path, 'rename.txt'), join(fixture.path, '改名\t[1].txt'))
    await writeFile(join(fixture.path, 'empty.txt'), '')
    await mkdir(join(fixture.path, 'dir'))
    await writeFile(join(fixture.path, 'dir', 'a * ? .txt'), 'literal\n')
    await symlink('/outside/private', join(fixture.path, 'link'))
    await fixture.commit()
    const result = await createComparison(fixture.project, 'refs/heads/feature', 'refs/heads/main')
    expect(result.files).toContainEqual({
      oldPath: 'rename.txt',
      newPath: '改名\t[1].txt',
      oldMode: '100644',
      newMode: '100644',
      status: 'renamed',
      added: 0,
      removed: 0,
    })
    const read = (path: string) =>
      readComparisonFile(fixture.project, result.baseOid, result.source.oid, path)
    await expect(read('empty.txt')).resolves.toMatchObject({
      kind: 'text',
      entry: { oldMode: null, newMode: '100644' },
      oldFile: null,
      newFile: { content: '' },
    })
    await expect(read('base.txt')).resolves.toMatchObject({
      kind: 'text',
      entry: { oldMode: '100644', newMode: null },
      newFile: null,
      oldFile: { content: 'base\n' },
    })
    await expect(read('改名\t[1].txt')).resolves.toMatchObject({
      kind: 'text',
      oldFile: { path: 'rename.txt' },
      newFile: { path: '改名\t[1].txt' },
    })
    await expect(read('dir/a * ? .txt')).resolves.toMatchObject({
      kind: 'text',
      newFile: { content: 'literal\n' },
    })
    await expect(read('link')).resolves.toMatchObject({
      kind: 'text',
      entry: { oldMode: null, newMode: '120000' },
      newFile: { content: '/outside/private' },
    })
    await expect(read('rename.txt')).rejects.toMatchObject({ code: 'file_not_found' })
    await expect(read('../base.txt')).rejects.toMatchObject({ code: 'invalid_query' })
  })

  it('reports binary, invalid UTF-8, oversized files and gitlinks without partial text', async () => {
    const fixture = await setup()
    await writeFile(join(fixture.path, 'binary.dat'), Buffer.from([1, 0, 2]))
    await writeFile(join(fixture.path, 'invalid.txt'), Buffer.from([255, 254]))
    await writeFile(join(fixture.path, 'large.txt'), 'x'.repeat(1024 * 1024 + 1))
    await fixture.git('add', '.')
    await fixture.git('update-index', '--add', '--cacheinfo', `160000,${fixture.baseOid},sub`)
    await fixture.git('commit', '-m', 'binary and gitlink')
    const result = await createComparison(fixture.project, 'refs/heads/feature', 'refs/heads/main')
    const read = (path: string) =>
      readComparisonFile(fixture.project, result.baseOid, result.source.oid, path)
    await expect(read('binary.dat')).resolves.toMatchObject({
      kind: 'unavailable',
      reason: 'binary',
    })
    await expect(read('invalid.txt')).resolves.toMatchObject({
      kind: 'unavailable',
      reason: 'binary',
    })
    await expect(read('large.txt')).resolves.toMatchObject({
      kind: 'unavailable',
      reason: 'oversized',
    })
    await expect(read('sub')).resolves.toMatchObject({
      kind: 'unavailable',
      reason: 'submodule',
      entry: { oldMode: null, newMode: '160000' },
    })
  })

  it('preserves executable mode changes with identical committed text', async () => {
    const fixture = await setup()
    await fixture.git('update-index', '--chmod=+x', 'base.txt')
    await fixture.git('commit', '-m', 'make executable')
    const result = await createComparison(fixture.project, 'refs/heads/feature', 'refs/heads/main')
    expect(result.files).toEqual([
      {
        oldPath: 'base.txt',
        newPath: 'base.txt',
        oldMode: '100644',
        newMode: '100755',
        status: 'modified',
        added: 0,
        removed: 0,
      },
    ])
    await expect(
      readComparisonFile(fixture.project, result.baseOid, result.source.oid, 'base.txt'),
    ).resolves.toMatchObject({
      kind: 'text',
      entry: result.files[0],
      oldFile: { content: 'base\n' },
      newFile: { content: 'base\n' },
    })
  })

  it.each([false, true])(
    'preserves original UTF-8 bytes when removing BOM = %s',
    async removing => {
      const fixture = await setup()
      const before = Buffer.from(`${removing ? '\uFEFF' : ''}原文\n`)
      const after = Buffer.from(`${removing ? '' : '\uFEFF'}原文\n`)
      await fixture.git('checkout', 'main')
      await writeFile(join(fixture.path, 'bom.txt'), before)
      await fixture.commit()
      await fixture.git('checkout', '-B', 'feature')
      await writeFile(join(fixture.path, 'bom.txt'), after)
      await fixture.commit()
      const result = await createComparison(
        fixture.project,
        'refs/heads/feature',
        'refs/heads/main',
      )
      const file = await readComparisonFile(
        fixture.project,
        result.baseOid,
        result.source.oid,
        'bom.txt',
      )
      expect(file.kind).toBe('text')
      if (file.kind !== 'text') throw new Error('Expected committed UTF-8 text.')
      expect(Buffer.from(file.oldFile?.content ?? '')).toEqual(before)
      expect(Buffer.from(file.newFile?.content ?? '')).toEqual(after)
    },
  )

  it.each([false, true])(
    'lists both files when converting directory to file = %s',
    async reverse => {
      const fixture = await setup()
      await fixture.git('checkout', 'main')
      if (reverse) await mkdir(join(fixture.path, 'config'))
      await writeFile(join(fixture.path, reverse ? 'config/app.ts' : 'config'), 'before\n')
      await fixture.commit()
      await fixture.git('checkout', '-B', 'feature')
      await rm(join(fixture.path, 'config'), { recursive: true })
      if (!reverse) await mkdir(join(fixture.path, 'config'))
      await writeFile(join(fixture.path, reverse ? 'config' : 'config/app.ts'), 'after\n')
      await fixture.commit()
      const result = await createComparison(
        fixture.project,
        'refs/heads/feature',
        'refs/heads/main',
      )
      expect(result.files).toHaveLength(2)
      await Promise.all(
        result.files.map(async entry => {
          const path = entry.newPath ?? entry.oldPath ?? ''
          const file = await readComparisonFile(
            fixture.project,
            result.baseOid,
            result.source.oid,
            path,
          )
          expect(file).toMatchObject({ kind: 'text', entry })
        }),
      )
      expect(result.files.map(entry => entry.newPath ?? entry.oldPath).toSorted()).toEqual([
        'config',
        'config/app.ts',
      ])
    },
  )

  it('lists full refs, resolves local remote HEAD defaults, and rejects revision expressions', async () => {
    const fixture = await setup()
    await fixture.git('update-ref', 'refs/remotes/origin/main', fixture.baseOid)
    await fixture.git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main')
    const result = await listCompareBranches(fixture.project)
    expect(result.defaultTargetRef).toBe('refs/remotes/origin/main')
    expect(result.items.map(item => item.ref)).toEqual([
      'refs/heads/feature',
      'refs/heads/main',
      'refs/remotes/origin/main',
    ])
    await expect(
      createComparison(fixture.project, 'HEAD~1', 'refs/heads/main'),
    ).rejects.toMatchObject({ code: 'ref_not_found' })
    await expect(
      readComparisonFile(fixture.project, 'HEAD', fixture.baseOid, 'base.txt'),
    ).rejects.toMatchObject({ code: 'invalid_query' })
    await expect(
      createComparison(fixture.project, 'refs/heads/main', 'refs/heads/main'),
    ).resolves.toMatchObject({ files: [] })
    await fixture.git('checkout', '--orphan', 'unrelated')
    await fixture.git('commit', '--allow-empty', '-m', 'unrelated')
    await expect(
      createComparison(fixture.project, 'refs/heads/unrelated', 'refs/heads/main'),
    ).rejects.toMatchObject({ code: 'no_merge_base' })
  })
})
