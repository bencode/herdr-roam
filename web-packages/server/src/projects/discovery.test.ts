import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { AgentRuntimeSnapshot } from '@herdr-roam/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentServiceApi } from '../agents/service.js'
import type { ProjectRegistryApi } from './registry.js'
import { findGitProjectRoot, startProjectDiscovery } from './discovery.js'

const directories: string[] = []

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'herdr-roam-discovery-'))
  directories.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

const snapshot = (cwd: string | null): AgentRuntimeSnapshot => ({
  source: { state: 'connected', version: '0.8.2', protocol: 20 },
  stale: false,
  items: [
    {
      id: 'terminal-1',
      name: 'codex-project',
      provider: 'codex',
      status: 'working',
      cwd,
      attachTarget: 'pane-1',
    },
  ],
})

describe('Agent Project discovery', () => {
  it('resolves nested Agent directories to a Git root and ignores non-Git directories', async () => {
    const root = await fixture()
    const repository = join(root, 'repository')
    const nested = join(repository, 'packages', 'web')
    const ordinary = join(root, 'ordinary')
    await mkdir(nested, { recursive: true })
    await mkdir(join(repository, '.git'))
    await mkdir(ordinary)

    await expect(findGitProjectRoot(nested)).resolves.toBe(await realpath(repository))
    await expect(findGitProjectRoot(ordinary)).resolves.toBeNull()
  })

  it('recognizes Git worktrees whose .git marker is a file', async () => {
    const root = await fixture()
    await writeFile(join(root, '.git'), 'gitdir: /tmp/worktree')
    await expect(findGitProjectRoot(root)).resolves.toBe(await realpath(root))
  })

  it('syncs only distinct Agent working directories into the registry', async () => {
    const root = await fixture()
    const canonicalRoot = await realpath(root)
    await mkdir(join(root, '.git'))
    let listener: ((value: AgentRuntimeSnapshot) => void) | null = null
    const agents: AgentServiceApi = {
      snapshot: () => snapshot(null),
      subscribe: next => {
        listener = next
        return () => {
          listener = null
        }
      },
      output: vi.fn(),
      prompt: vi.fn(),
      focus: vi.fn(),
      launch: vi.fn(),
    }
    const projects: ProjectRegistryApi = {
      snapshot: vi.fn(),
      get: vi.fn(),
      add: vi.fn(),
      discover: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn(),
      subscribe: vi.fn(),
    }
    const stop = startProjectDiscovery(agents, projects)
    listener?.(snapshot(root))
    listener?.(snapshot(root))
    await vi.waitFor(() => expect(projects.discover).toHaveBeenCalledWith([canonicalRoot]))
    expect(projects.discover).toHaveBeenCalledTimes(1)
    stop()
  })
})
