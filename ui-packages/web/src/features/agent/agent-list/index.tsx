import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cn } from '../../../lib/cn'
import { useAssistantStore } from '../../assistant/store'
import {
  agentDirectoryLabel,
  agentMatches,
  agentProviderLabel,
  agentStatusClasses,
  agentStatusLabels,
  agentStatusOrder,
} from '../presentation'
import { useAgentRuntime } from '../runtime-provider'

export const AgentList = () => {
  const { snapshot, transportError } = useAgentRuntime()
  const activeAgentId = useAssistantStore(state => state.activeAgentId)
  const openAgent = useAssistantStore(state => state.openAgent)
  const [query, setQuery] = useState('')
  const filtered = useMemo(
    () => snapshot.items.filter(agent => agentMatches(agent, query)),
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
            'mx-2.5 mb-2 rounded-md border px-2.5 py-2 text-2xs leading-4',
            snapshot.stale
              ? 'border-warning/30 bg-warning/8 text-muted'
              : 'border-danger/30 bg-danger/8 text-muted',
          )}
        >
          {snapshot.source.message}
          {transportError && (
            <span className="mt-1 block text-faint">{transportError.message}</span>
          )}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-auto px-1.75 pb-3.5">
        {agentStatusOrder.map(status => {
          const agents = filtered.filter(agent => agent.status === status)
          if (agents.length === 0) return null
          return (
            <section className="mb-2" key={status}>
              <h2 className="m-0 flex h-7 items-center px-2 text-2xs font-semibold uppercase tracking-[0.08em] text-faint">
                <span>{agentStatusLabels[status]}</span>
                <span className="ml-auto font-normal tabular-nums">{agents.length}</span>
              </h2>
              {agents.map(agent => {
                const active = agent.id === activeAgentId
                const context = [agentProviderLabel(agent.provider), agentDirectoryLabel(agent.cwd)]
                  .filter(value => value !== null)
                  .join(' · ')
                return (
                  <button
                    type="button"
                    key={agent.id}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-sm border-0 px-2 py-2 text-left [&>i]:mt-[0.32rem]',
                      active ? 'bg-primary-soft text-foreground' : 'bg-transparent hover:bg-hover',
                    )}
                    onClick={() => openAgent(agent.id)}
                    title={agent.cwd ?? undefined}
                  >
                    <i
                      className={cn(
                        'size-1.5 flex-none rounded-full',
                        agentStatusClasses[agent.status],
                      )}
                      role="img"
                      aria-label={agent.status}
                    />
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <strong className="truncate text-xs font-semibold">{agent.name}</strong>
                      <small
                        className={cn(
                          'truncate text-2xs',
                          active ? 'text-muted' : 'text-faint',
                        )}
                      >
                        {context || 'Runtime agent'}
                      </small>
                    </span>
                  </button>
                )
              })}
            </section>
          )
        })}
        {filtered.length === 0 && (
          <p className="mx-2 mt-6 text-center text-xs text-faint">
            {snapshot.items.length === 0
              ? 'No agents are available.'
              : 'No agents match this search.'}
          </p>
        )}
      </div>
    </div>
  )
}
