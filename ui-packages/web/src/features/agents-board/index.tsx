import type { AgentStatus, AgentSummary } from '@herdr-roam/shared'
import { type ReactNode, useEffect, useState } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../../ui/button'
import { SegmentedControl } from '../../ui/segmented-control'
import { ToggleChip } from '../../ui/toggle-chip'
import { agentStatusLabels, agentStatusOrder } from '../agent/presentation'
import { useAgentRuntime } from '../agent/runtime-provider'
import { StatusDot } from '../agent/status-dot'
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
const columnOptions = columnChoices.map(choice => ({
  value: choice,
  label: choice === 'auto' ? 'Auto' : choice,
}))
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
    <h2 className="m-0 mb-2 flex h-7 items-center gap-2 text-2xs font-semibold uppercase tracking-[0.08em] text-faint">
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
  const [columns, setColumns] = useState(readColumns)
  const now = useNow(15_000)

  const visible = snapshot.items
    .filter(agent => statuses.size === 0 || statuses.has(agent.status))
    .toSorted((left, right) => left.name.localeCompare(right.name))
  const byStatus = (status: AgentStatus): readonly AgentSummary[] =>
    visible.filter(agent => agent.status === status)
  const blocked = byStatus('blocked')
  const quiet = visible.filter(agent => quietStatuses.includes(agent.status))
  const hasCards = blocked.length > 0 || byStatus('working').length > 0

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
      <header className="flex flex-none flex-wrap items-center gap-0.5 border-border border-b px-3 py-1.5">
        {agentStatusOrder.map(status => {
          const count = snapshot.items.filter(agent => agent.status === status).length
          if (count === 0 && status === 'unknown') return null
          return (
            <ToggleChip
              key={status}
              pressed={statuses.has(status)}
              onClick={() => toggleStatus(status)}
            >
              <StatusDot status={status} label={null} />
              {agentStatusLabels[status]}
              <span
                className={cn(
                  'tabular-nums',
                  count === 0
                    ? 'text-faint'
                    : status === 'blocked' && 'font-semibold text-warning-text',
                )}
              >
                {count}
              </span>
            </ToggleChip>
          )
        })}
        {hasCards && (
          <SegmentedControl
            size="sm"
            label="Columns"
            className="ml-auto"
            options={columnOptions}
            value={columns}
            onValueChange={value => {
              setColumns(value)
              writeColumns(value)
            }}
          />
        )}
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
