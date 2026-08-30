import type { AgentStatus, AgentSummary } from '@herdr-roam/shared'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cn } from '../../../lib/cn'
import type { ResourceRef } from '../../../workbench/resource'
import { useAgentRuntime } from '../runtime-provider'

const groups: readonly { readonly status: AgentStatus; readonly label: string }[] = [
  { status: 'blocked', label: 'Blocked' },
  { status: 'working', label: 'Working' },
  { status: 'idle', label: 'Idle' },
  { status: 'done', label: 'Done' },
  { status: 'unknown', label: 'Unknown' },
]

const statusClasses: Readonly<Record<AgentStatus, string>> = {
  blocked: 'bg-warning',
  working: 'bg-primary',
  idle: 'bg-muted',
  done: 'bg-success',
  unknown: 'bg-faint',
}

const matches = (agent: AgentSummary, query: string): boolean => {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return [agent.name, agent.provider, agent.cwd].some(value =>
    value?.toLowerCase().includes(normalized),
  )
}

export const AgentList = ({
  onOpen,
}: {
  readonly onOpen: (resource: ResourceRef) => void
}) => {
  const { snapshot, transportError } = useAgentRuntime()
  const [query, setQuery] = useState('')
  const filtered = useMemo(
    () => snapshot.items.filter(agent => matches(agent, query)),
    [query, snapshot.items],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <label className="mx-2.5 mt-3 mb-2 flex h-8 flex-none items-center gap-2 rounded-md border border-border bg-surface px-2 transition-[border-color,box-shadow] duration-150 focus-within:border-primary focus-within:shadow-[0_0_0_1px_var(--primary)] [&>svg]:w-3.5 [&>svg]:text-faint">
        <Search aria-hidden="true" />
        <span className="sr-only">Search agents</span>
        <input
          className="min-w-0 flex-1 border-0 bg-transparent text-xs outline-none! placeholder:text-faint"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search agents…"
        />
      </label>
      {snapshot.source.state !== 'connected' && (
        <div
          className={cn(
            'mx-2.5 mb-2 rounded-md border px-2.5 py-2 text-[0.6875rem] leading-4',
            snapshot.stale
              ? 'border-warning/30 bg-warning/8 text-muted'
              : 'border-danger/30 bg-danger/8 text-muted',
          )}
        >
          {snapshot.source.message}
          {transportError && <span className="mt-1 block text-faint">{transportError.message}</span>}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto px-1.75 pb-3.5">
        {groups.map(group => {
          const agents = filtered.filter(agent => agent.status === group.status)
          if (agents.length === 0) return null
          return (
            <section className="mb-2" key={group.status}>
              <h2 className="m-0 flex h-7 items-center px-2 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-faint">
                <span>{group.label}</span>
                <span className="ml-auto font-normal tabular-nums">{agents.length}</span>
              </h2>
              {agents.map(agent => (
                <button
                  type="button"
                  key={agent.id}
                  className="flex w-full items-start gap-2.5 rounded-sm border-0 bg-transparent px-2 py-2 text-left hover:bg-hover [&>i]:mt-[0.32rem]"
                  onClick={() => onOpen({ type: 'agent', agentId: agent.id })}
                >
                  <i
                    className={cn('size-1.5 flex-none rounded-full', statusClasses[agent.status])}
                    role="img"
                    aria-label={agent.status}
                  />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <strong className="truncate text-xs font-semibold">{agent.name}</strong>
                    <small className="truncate text-[0.625rem] text-faint">
                      {[agent.provider, agent.cwd].filter(Boolean).join(' · ') || 'Runtime agent'}
                    </small>
                  </span>
                </button>
              ))}
            </section>
          )
        })}
        {filtered.length === 0 && (
          <p className="mx-2 mt-6 text-center text-xs text-faint">
            {snapshot.items.length === 0 ? 'No agents are available.' : 'No agents match this search.'}
          </p>
        )}
      </div>
    </div>
  )
}
