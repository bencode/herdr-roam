import type { AgentInputKey, AgentSummary } from '@herdr-roam/shared'
import { useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../../ui/button'
import { sendAgentInput } from '../agent/client'
import {
  agentDirectoryLabel,
  agentProviderLabel,
  agentStatusLabels,
  formatElapsed,
} from '../agent/presentation'
import { StatusDot } from '../agent/status-dot'
import { TerminalPreview } from './terminal-preview'
import { useAgentScreen } from './use-agent-screen'

type CardProps = {
  readonly agent: AgentSummary
  readonly since: string | undefined
  readonly now: number
  readonly onOpen: (agentId: string) => void
}

const Heading = ({ agent, since, now }: Omit<CardProps, 'onOpen'>) => {
  const elapsed = formatElapsed(since, now)
  const context = [agentProviderLabel(agent.provider), agentDirectoryLabel(agent.cwd)]
    .filter(value => value !== null)
    .join(' · ')
  return (
    <>
      <StatusDot status={agent.status} />
      <span className="min-w-0 truncate font-medium text-foreground">{agent.name}</span>
      <span className="min-w-0 truncate text-muted" title={agent.cwd ?? undefined}>
        {context}
      </span>
      <span
        className="ml-auto flex-none text-muted tabular-nums"
        title={
          since ? `Observed by Herdr Roam since ${new Date(since).toLocaleString()}` : undefined
        }
      >
        {agentStatusLabels[agent.status]}
        {elapsed && ` · ${elapsed}`}
      </span>
    </>
  )
}

export const AgentRow = ({ agent, since, now, onOpen }: CardProps) => (
  <button
    type="button"
    className="flex h-8 w-full items-center gap-2 rounded-sm border-0 bg-transparent px-2 text-left text-xs hover:bg-hover"
    onClick={() => onOpen(agent.id)}
  >
    <Heading agent={agent} since={since} now={now} />
  </button>
)

export const AgentCard = ({ agent, since, now, onOpen }: CardProps) => {
  const root = useRef<HTMLElement>(null)
  const screen = useAgentScreen(agent.id, agent.status, root)
  const [inputError, setInputError] = useState<string | null>(null)
  const blocked = agent.status === 'blocked'

  const send = async (key: AgentInputKey) => {
    setInputError(null)
    try {
      await sendAgentInput(agent.id, { type: 'keys', keys: [key] })
    } catch (error) {
      console.error('Agent quick response failed', error)
      setInputError(error instanceof Error ? error.message : 'The key could not be sent.')
    }
  }

  return (
    <article
      ref={root}
      aria-label={agent.name}
      className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-md border bg-surface',
        blocked ? 'border-warning' : 'border-border',
      )}
    >
      <button
        type="button"
        className="flex h-8 flex-none items-center gap-2 border-0 border-border border-b bg-transparent px-2.5 text-left text-xs hover:bg-hover"
        onClick={() => onOpen(agent.id)}
        title="Open in the Assistant panel"
      >
        <Heading agent={agent} since={since} now={now} />
      </button>
      <TerminalPreview text={screen.text} rows={blocked ? 14 : 10} />
      {(blocked || screen.error || inputError) && (
        <footer className="flex flex-none items-center gap-1.5 border-border border-t px-2 py-1.5 text-xs">
          <span className="min-w-0 flex-1 truncate text-danger" role="status">
            {inputError ?? screen.error}
          </span>
          {blocked && (
            <>
              <Button size="compact" onClick={() => void send('esc')}>
                Esc
              </Button>
              <Button size="compact" variant="primary" onClick={() => void send('enter')}>
                Accept
              </Button>
              <Button size="compact" onClick={() => onOpen(agent.id)}>
                Open
              </Button>
            </>
          )}
        </footer>
      )}
    </article>
  )
}
