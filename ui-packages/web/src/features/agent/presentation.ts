import type { AgentStatus, AgentSummary } from '@herdr-roam/shared'

export const agentProviderLabel = (provider: string | null): string | null => {
  if (provider === 'codex') return 'Codex'
  if (provider === 'claude') return 'Claude'
  return provider
}

export const agentDirectoryLabel = (cwd: string | null): string | null => {
  if (!cwd) return null
  const withoutTrailingSeparator = cwd.replace(/[\\/]+$/, '')
  if (!withoutTrailingSeparator) return cwd[0] ?? null
  return withoutTrailingSeparator.split(/[\\/]/).filter(Boolean).at(-1) ?? cwd
}

export const agentStatusOrder: readonly AgentStatus[] = [
  'blocked',
  'working',
  'idle',
  'done',
  'unknown',
]

export const agentStatusLabels: Readonly<Record<AgentStatus, string>> = {
  blocked: 'Blocked',
  working: 'Working',
  idle: 'Idle',
  done: 'Done',
  unknown: 'Unknown',
}

export const agentStatusClasses: Readonly<Record<AgentStatus, string>> = {
  blocked: 'bg-warning',
  working: 'bg-primary',
  idle: 'bg-muted',
  done: 'bg-success',
  unknown: 'bg-faint',
}

export const formatElapsed = (since: string | undefined, now: number): string | null => {
  const start = since ? Date.parse(since) : Number.NaN
  if (Number.isNaN(start)) return null
  const seconds = Math.max(0, Math.floor((now - start) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

export const agentMatches = (agent: AgentSummary, query: string): boolean => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return [agent.name, agent.provider, agent.cwd].some(value =>
    value?.toLowerCase().includes(normalized),
  )
}

export const agentAttachCommand = (agent: AgentSummary): string =>
  `herdr agent attach ${agent.attachTarget}`
