import { basename, isAbsolute } from 'node:path'
import type {
  AgentRuntimeSnapshot,
  AgentStatus,
  AgentSummary,
  ObservedProjectDirectory,
} from '@herdr-roam/shared'
import type { RawAgent, RawPane } from '../herdr/schema.js'

const value = (...candidates: readonly (string | null | undefined)[]): string | null =>
  candidates.find(candidate => candidate !== null && candidate !== undefined && candidate !== '') ??
  null

const status = (raw: string): AgentStatus => {
  if (raw === 'blocked' || raw === 'working' || raw === 'idle' || raw === 'done') return raw
  return 'unknown'
}

export const mapAgent = (raw: RawAgent): AgentSummary => ({
  id: raw.terminal_id,
  name:
    value(
      raw.name,
      raw.title,
      raw.terminal_title_stripped,
      raw.display_agent,
      raw.agent,
      raw.terminal_id,
    ) ?? raw.terminal_id,
  provider: value(raw.agent),
  status: status(raw.agent_status),
  cwd: value(raw.foreground_cwd, raw.cwd),
  attachTarget: raw.pane_id,
})

export const mapAgents = (agents: readonly RawAgent[]): readonly AgentSummary[] =>
  agents.map(mapAgent).toSorted((left, right) => {
    const byName = left.name.localeCompare(right.name)
    return byName === 0 ? left.id.localeCompare(right.id) : byName
  })

const suggestedName = (path: string): string => {
  const normalized = basename(path)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .slice(0, 64)
  return normalized || 'project'
}

type DirectoryCounts = { agentCount: number; paneCount: number }

const directory = (cwd: string | null | undefined): string | null => {
  if (!cwd || !isAbsolute(cwd)) return null
  return cwd
}

export const mapObservedDirectories = (
  agents: readonly RawAgent[],
  panes: readonly RawPane[],
): readonly ObservedProjectDirectory[] => {
  const counts = new Map<string, DirectoryCounts>()
  panes.forEach(pane => {
    const path = directory(value(pane.foreground_cwd, pane.cwd))
    if (!path) return
    const current = counts.get(path) ?? { agentCount: 0, paneCount: 0 }
    counts.set(path, { ...current, paneCount: current.paneCount + 1 })
  })
  agents.forEach(agent => {
    const path = directory(value(agent.foreground_cwd, agent.cwd))
    if (!path) return
    const current = counts.get(path) ?? { agentCount: 0, paneCount: 0 }
    counts.set(path, { ...current, agentCount: current.agentCount + 1 })
  })
  return [...counts.entries()]
    .map(([path, count]) => ({ path, suggestedName: suggestedName(path), ...count }))
    .toSorted(
      (left, right) => right.agentCount - left.agentCount || left.path.localeCompare(right.path),
    )
}

const sameAgent = (left: AgentSummary, right: AgentSummary): boolean =>
  left.id === right.id &&
  left.name === right.name &&
  left.provider === right.provider &&
  left.status === right.status &&
  left.cwd === right.cwd &&
  left.attachTarget === right.attachTarget

const sameSource = (
  left: AgentRuntimeSnapshot['source'],
  right: AgentRuntimeSnapshot['source'],
): boolean => {
  if (left.state !== right.state) return false
  if (left.state === 'connected' && right.state === 'connected') {
    return left.version === right.version && left.protocol === right.protocol
  }
  if (left.state !== 'connected' && right.state !== 'connected') {
    return left.code === right.code && left.message === right.message
  }
  return false
}

const sameDirectory = (
  left: ObservedProjectDirectory,
  right: ObservedProjectDirectory,
): boolean =>
  left.path === right.path &&
  left.suggestedName === right.suggestedName &&
  left.agentCount === right.agentCount &&
  left.paneCount === right.paneCount

export const sameAgentSnapshot = (
  left: AgentRuntimeSnapshot,
  right: AgentRuntimeSnapshot,
): boolean =>
  left.stale === right.stale &&
  sameSource(left.source, right.source) &&
  left.items.length === right.items.length &&
  left.items.every((agent, index) => {
    const candidate = right.items[index]
    return candidate ? sameAgent(agent, candidate) : false
  }) &&
  left.observedDirectories.length === right.observedDirectories.length &&
  left.observedDirectories.every((directory, index) => {
    const candidate = right.observedDirectories[index]
    return candidate ? sameDirectory(directory, candidate) : false
  })
