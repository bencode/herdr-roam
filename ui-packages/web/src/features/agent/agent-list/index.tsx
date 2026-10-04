import { useMemo, useState } from 'react'
import { useAssistantStore } from '../../assistant/store'
import {
  agentDirectoryLabel,
  agentMatches,
  agentProviderLabel,
  agentStatusLabels,
  agentStatusOrder,
} from '../presentation'
import { Banner } from '../../../ui/banner'
import { EmptyState } from '../../../ui/empty-state'
import {
  listRowClass,
  listRowMarkerClass,
  listRowMetaClass,
  listRowTextClass,
  listRowTitleClass,
} from '../../../ui/list-row'
import { SearchField } from '../../../ui/search-field'
import { SectionHeader } from '../../../ui/section-header'
import { useAgentRuntime } from '../runtime-provider'
import { StatusDot } from '../status-dot'

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
      <SearchField
        className="mx-2.5 my-2 flex-none"
        label="Search agents"
        placeholder="Search agents…"
        value={query}
        onChange={event => setQuery(event.target.value)}
      />
      {snapshot.source.state !== 'connected' && (
        <Banner tone={snapshot.stale ? 'warning' : 'danger'} inset className="mx-2.5 mb-2">
          {snapshot.source.message}
          {transportError && (
            <span className="mt-1 block text-faint">{transportError.message}</span>
          )}
        </Banner>
      )}
      <div className="min-h-0 flex-1 overflow-auto px-1.75 pb-3.5">
        {agentStatusOrder.map(status => {
          const agents = filtered.filter(agent => agent.status === status)
          if (agents.length === 0) return null
          return (
            <section className="mb-2" key={status}>
              <SectionHeader title={agentStatusLabels[status]} count={agents.length} />
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
                    className={listRowClass}
                    onClick={() => openAgent(agent.id)}
                    title={agent.cwd ?? undefined}
                  >
                    <StatusDot status={agent.status} className={listRowMarkerClass} />
                    <span className={listRowTextClass}>
                      <strong className={listRowTitleClass}>{agent.name}</strong>
                      <small className={listRowMetaClass}>{context || 'Runtime agent'}</small>
                    </span>
                  </button>
                )
              })}
            </section>
          )
        })}
        {filtered.length === 0 && (
          <EmptyState>
            {snapshot.items.length === 0
              ? 'No agents are available.'
              : 'No agents match this search.'}
          </EmptyState>
        )}
      </div>
    </div>
  )
}
