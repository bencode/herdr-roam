import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import {
  directoryBelongsToWorkspaces,
  listProjectWorkspaces,
  resolveProjectWorkspace,
} from './workspaces.js'

const execFileAsync = promisify(execFile)
const directories: string[] = []

const git = (cwd: string, ...args: readonly string[]) =>
  execFileAsync('git', ['-C', cwd, ...args], { encoding: 'utf8' })

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'herdr-roam-workspaces-'))
  directories.push(root)
  const repository = join(root, 'repository')
  const linked = join(root, 'linked-task')
  await mkdir(repository)
  await git(repository, 'init', '-b', 'main')
  await git(repository, 'config', 'user.email', 'test@example.com')
  await git(repository, 'config', 'user.name', 'Test User')
  await writeFile(join(repository, 'README.md'), '# Main\n')
  await git(repository, 'add', 'README.md')
  await git(repository, 'commit', '-m', 'initial')
  await git(repository, 'branch', 'task')
  await git(repository, 'worktree', 'add', linked, 'task')
  return { repository: await realpath(repository), linked: await realpath(linked) }
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('Project Workspaces', () => {
  it('lists real Git worktrees and resolves only catalogued identifiers', async () => {
    const { repository, linked } = await fixture()
    const project = { name: 'repository', path: repository }
    const workspaces = await listProjectWorkspaces(project)

    expect(workspaces).toHaveLength(2)
    expect(workspaces[0]).toMatchObject({
      id: 'primary',
      name: 'repository',
      path: repository,
      branch: 'main',
      primary: true,
    })
    const task = workspaces.find(workspace => workspace.path === linked)
    expect(task).toMatchObject({ branch: 'task', kind: 'worktree', primary: false })
    await expect(resolveProjectWorkspace(project, task?.id ?? '')).resolves.toMatchObject({
      path: linked,
    })
    await expect(resolveProjectWorkspace(project, linked)).rejects.toMatchObject({
      code: 'workspace_not_found',
    })
    expect(directoryBelongsToWorkspaces(workspaces, join(linked, 'src'))).toBe(true)
    expect(directoryBelongsToWorkspaces(workspaces, `${linked}-other`)).toBe(false)
  })

  it('exposes a single primary Workspace for a non-Git directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'herdr-roam-directory-'))
    directories.push(root)
    const canonical = await realpath(root)
    await expect(listProjectWorkspaces({ name: 'directory', path: canonical })).resolves.toEqual([
      {
        id: 'primary',
        name: canonical.split('/').at(-1),
        path: canonical,
        kind: 'directory',
        branch: null,
        primary: true,
      },
    ])
  })
})
