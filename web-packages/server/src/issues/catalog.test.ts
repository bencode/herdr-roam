import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { listIssues, readIssue } from './catalog.js'

const directories: string[] = []

const fixture = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'herdr-roam-issues-'))
  directories.push(root)
  return root
}

const configure = async (root: string): Promise<string> => {
  const directory = join(root, 'docs', 'issues')
  await mkdir(directory, { recursive: true })
  await writeFile(
    join(root, '.herdr-roam.json'),
    `${JSON.stringify({ version: 1, issues: { directory: 'docs/issues' } })}\n`,
  )
  return directory
}

const issueText = (
  id: string,
  values: { readonly title: string; readonly priority?: string; readonly labels?: string } = {
    title: 'Issue',
  },
): string => `---
id: ${id}
title: ${values.title}
status: open
${values.priority ? `priority: ${values.priority}\n` : ''}${values.labels ? `labels: ${values.labels}\n` : ''}---
Body for ${values.title}.
`

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('Issue catalog', () => {
  it('reads Markdown Issues, normalizes labels, and sorts by priority then id', async () => {
    const root = await fixture()
    const directory = await configure(root)
    const later = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    const urgent = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    await writeFile(join(directory, `${later}.md`), issueText(later, { title: 'Later' }))
    await writeFile(
      join(directory, `${urgent}.md`),
      issueText(urgent, { title: 'Urgent', priority: 'p0', labels: '[release]' }),
    )

    await expect(listIssues(root)).resolves.toMatchObject({
      items: [
        { id: urgent, priority: 'p0', labels: ['release'] },
        { id: later, labels: [] },
      ],
      warnings: [],
    })
    await expect(readIssue(root, urgent)).resolves.toMatchObject({
      path: `docs/issues/${urgent}.md`,
      body: 'Body for Urgent.\n',
    })
  })

  it('reports malformed files without suppressing valid Issues', async () => {
    const root = await fixture()
    const directory = await configure(root)
    const valid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    await writeFile(join(directory, `${valid}.md`), issueText(valid, { title: 'Valid' }))
    await writeFile(join(directory, 'not-an-id.md'), 'invalid')

    await expect(listIssues(root)).resolves.toMatchObject({
      items: [{ id: valid }],
      warnings: [{ path: 'docs/issues/not-an-id.md', code: 'invalid_issue' }],
    })
  })

  it('rejects missing configuration and Issue directories that escape through symlinks', async () => {
    const root = await fixture()
    await expect(listIssues(root)).rejects.toMatchObject({ code: 'issue_store_not_configured' })

    const outside = await fixture()
    await mkdir(join(outside, 'issues'))
    await symlink(join(outside, 'issues'), join(root, 'issues'))
    await writeFile(
      join(root, '.herdr-roam.json'),
      `${JSON.stringify({ version: 1, issues: { directory: 'issues' } })}\n`,
    )
    await expect(listIssues(root)).rejects.toMatchObject({ code: 'issue_store_unavailable' })
  })
})
