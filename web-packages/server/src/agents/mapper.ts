import type { AgentRuntimeSnapshot, AgentStatus, AgentSummary } from '@herdr-roam/shared'
import type { RawAgent } from '../herdr/schema.js'

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
  session: raw.agent_session
    ? {
        source: raw.agent_session.source,
        agent: raw.agent_session.agent,
        kind: raw.agent_session.kind,
        value: raw.agent_session.value,
      }
    : null,
})

export const mapAgents = (agents: readonly RawAgent[]): readonly AgentSummary[] =>
  agents.map(mapAgent).toSorted((left, right) => {
    const byName = left.name.localeCompare(right.name)
    return byName === 0 ? left.id.localeCompare(right.id) : byName
  })

const sameAgent = (left: AgentSummary, right: AgentSummary): boolean =>
  left.id === right.id &&
  left.name === right.name &&
  left.provider === right.provider &&
  left.status === right.status &&
  left.cwd === right.cwd &&
  left.attachTarget === right.attachTarget &&
  left.session?.source === right.session?.source &&
  left.session?.agent === right.session?.agent &&
  left.session?.kind === right.session?.kind &&
  left.session?.value === right.session?.value

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
  })
