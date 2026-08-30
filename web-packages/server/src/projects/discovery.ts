import { lstat, realpath } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { AgentRuntimeSnapshot } from '@herdr-roam/shared'
import type { AgentServiceApi } from '../agents/service.js'
import type { ProjectRegistryApi } from './registry.js'

const isMissing = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')

export const findGitProjectRoot = async (cwd: string): Promise<string | null> => {
  let current: string
  try {
    current = await realpath(cwd)
  } catch (error) {
    if (isMissing(error)) return null
    throw error
  }
  while (true) {
    try {
      await lstat(join(current, '.git'))
      return current
    } catch (error) {
      if (!isMissing(error)) throw error
    }
    const parent = dirname(current)
    if (parent === current) return null
    current = parent
  }
}

const agentDirectories = (snapshot: AgentRuntimeSnapshot): readonly string[] =>
  [...new Set(snapshot.items.flatMap(agent => (agent.cwd ? [agent.cwd] : [])))].toSorted()

export const startProjectDiscovery = (
  agents: AgentServiceApi,
  projects: ProjectRegistryApi,
): (() => void) => {
  let active = true
  let lastDirectories = ''

  const discover = async (snapshot: AgentRuntimeSnapshot) => {
    const directories = agentDirectories(snapshot)
    const key = directories.join('\n')
    if (key === lastDirectories) return
    lastDirectories = key
    const roots = await Promise.all(directories.map(findGitProjectRoot))
    if (!active) return
    await projects.discover(roots.flatMap(root => (root ? [root] : [])))
  }

  const sync = (snapshot: AgentRuntimeSnapshot) => {
    void discover(snapshot).catch(error => console.error('Agent Project discovery failed', error))
  }

  sync(agents.snapshot())
  const unsubscribe = agents.subscribe(sync)
  return () => {
    active = false
    unsubscribe()
  }
}
