import type { AgentStatus, AgentSummary } from '@herdr-roam/shared'
import { Search } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../../ui/button'
import {
  agentDirectoryLabel,
  agentMatches,
  agentStatusClasses,
  agentStatusLabels,
  agentStatusOrder,
} from '../agent/presentation'
import { useAgentRuntime } from '../agent/runtime-provider'
import { useAssistantStore } from '../assistant/store'
import { AgentCard, AgentRow } from './agent-card'

const COLUMNS_KEY = 'herdr-roam.agents-board.v1'
const columnChoices = ['auto', '2', '3', '4', '5'] as const
type Columns = (typeof columnChoices)[number]
const gridClasses: Readonly<Record<Columns, string>> = {
  auto: 'grid-cols-[repeat(auto-fill,minmax(20rem,1fr))]',
  '2': 'grid-cols-2',
  '3': 'grid-cols-3',
  '4': 'grid-cols-4',
  '5': 'grid-cols-5',
}
const quietStatuses: readonly AgentStatus[] = ['idle', 'done', 'unknown']

const readColumns = (): Columns => {
  try {
    const value = globalThis.localStorage?.getItem(COLUMNS_KEY)
    return columnChoices.find(choice => choice === value) ?? 'auto'
  } catch (error) {
    console.error('agents board columns read failed', error)
    return 'auto'
  }
}

const writeColumns = (columns: Columns): void => {
  try {
    globalThis.localStorage?.setItem(COLUMNS_KEY, columns)
  } catch (error) {
    console.error('agents board columns write failed', error)
  }
}

const useNow = (intervalMs: number): number => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

const Section = ({
  title,
  count,
  action,
  children,
}: {
  readonly title: string
  readonly count: number
  readonly action?: ReactNode
  readonly children: ReactNode
}) => (
  <section className="mb-5" aria-label={title}>
    <h2 className="m-0 mb-2 flex h-7 items-center gap-2 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-faint">
      <span>{title}</span>
      <span className="font-normal tabular-nums">{count}</span>
      <span className="ml-auto normal-case tracking-normal">{action}</span>
    </h2>
    {children}
  </section>
)

export const AgentsBoard = () => {
  const { snapshot } = useAgentRuntime()
  const openAgent = useAssistantStore(state => state.openAgent)
  const activeAgentId = useAssistantStore(state => state.activeAgentId)
  const [statuses, setStatuses] = useState<ReadonlySet<AgentStatus>>(new Set())
  const [directory, setDirectory] = useState('')
  const [query, setQuery] = useState('')
  const [columns, setColumns] = useState(readColumns)
  const now = useNow(15_000)

  const directories = [
    ...new Set(snapshot.items.flatMap(agent => agentDirectoryLabel(agent.cwd) ?? [])),
  ].toSorted()
  const scoped = snapshot.items.filter(
    agent =>
      (!directory || agentDirectoryLabel(agent.cwd) === directory) && agentMatches(agent, query),
  )
  const visible = scoped
    .filter(agent => statuses.size === 0 || statuses.has(agent.status))
    .toSorted((left, right) => left.name.localeCompare(right.name))
  const byStatus = (status: AgentStatus): readonly AgentSummary[] =>
    visible.filter(agent => agent.status === status)
  const blocked = byStatus('blocked')
  const quiet = visible.filter(agent => quietStatuses.includes(agent.status))

  const toggleStatus = (status: AgentStatus) =>
    setStatuses(current => {
      const next = new Set(current)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })

  const nextBlocked = () => {
    const index = blocked.findIndex(agent => agent.id === activeAgentId)
    const next = blocked[(index + 1) % blocked.length]
    if (next) openAgent(next.id)
  }

  const grid = gridClasses[columns]
  const cardProps = (agent: AgentSummary) => ({
    agent,
    since: snapshot.statusSince[agent.id],
    now,
    onOpen: openAgent,
  })

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex flex-none flex-wrap items-center gap-1.5 border-border border-b px-4 py-2">
        {agentStatusOrder.map(status => {
          const count = scoped.filter(agent => agent.status === status).length
          if (count === 0 && status === 'unknown') return null
          return (
            <button
              type="button"
              key={status}
              aria-pressed={statuses.has(status)}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 text-xs text-muted hover:bg-hover',
                statuses.has(status) && 'border-primary bg-primary-soft text-foreground',
              )}
              onClick={() => toggleStatus(status)}
            >
              <i
                className={cn('size-1.5 rounded-full', agentStatusClasses[status])}
                aria-hidden="true"
              />
              {agentStatusLabels[status]}
              <span className="tabular-nums">{count}</span>
            </button>
          )
        })}
        <select
          aria-label="Directory"
          className="ml-auto h-7 rounded-md border border-border bg-surface px-2 text-xs"
          value={directory}
          onChange={event => setDirectory(event.target.value)}
        >
          <option value="">All directories</option>
          {directories.map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <label className="flex h-7 w-48 items-center gap-1.5 rounded-md border border-border px-2 focus-within:border-primary [&>svg]:w-3.5 [&>svg]:text-faint">
          <Search aria-hidden="true" />
          <input
            aria-label="Search agents board"
            className="min-w-0 flex-1 border-0 bg-transparent text-xs outline-none! placeholder:text-faint"
            placeholder="Search…"
            value={query}
            onChange={event => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Columns"
          className="h-7 rounded-md border border-border bg-surface px-2 text-xs"
          value={columns}
          onChange={event => {
            const value = columnChoices.find(choice => choice === event.target.value) ?? 'auto'
            setColumns(value)
            writeColumns(value)
          }}
        >
          {columnChoices.map(choice => (
            <option key={choice} value={choice}>
              {choice === 'auto' ? 'Auto columns' : `${choice} columns`}
            </option>
          ))}
        </select>
      </header>
      {(snapshot.stale || snapshot.source.state !== 'connected') && (
        <p className="m-0 flex-none border-warning/30 border-b bg-warning/8 px-4 py-1.5 text-xs text-muted">
          Agent status may be out of date.{' '}
          {snapshot.source.state !== 'connected' && snapshot.source.message}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-auto px-4 pt-4">
        {visible.length === 0 && (
          <p className="mt-16 text-center text-sm text-muted">
            {snapshot.items.length === 0
              ? 'No Agents are running in Herdr.'
              : 'No Agents match these filters.'}
          </p>
        )}
        {blocked.length > 0 && (
          <Section
            title="Blocked"
            count={blocked.length}
            action={
              <Button size="compact" onClick={nextBlocked}>
                Next blocked →
              </Button>
            }
          >
            <div className={cn('grid gap-3', grid)}>
              {blocked.map(agent => (
                <AgentCard key={agent.id} {...cardProps(agent)} />
              ))}
            </div>
          </Section>
        )}
        {byStatus('working').length > 0 && (
          <Section title="Working" count={byStatus('working').length}>
            <div className={cn('grid gap-3', grid)}>
              {byStatus('working').map(agent => (
                <AgentCard key={agent.id} {...cardProps(agent)} />
              ))}
            </div>
          </Section>
        )}
        {quiet.length > 0 && (
          <Section title="Idle · Done" count={quiet.length}>
            <div className="grid gap-0.5">
              {quiet.map(agent => (
                <AgentRow key={agent.id} {...cardProps(agent)} />
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}
