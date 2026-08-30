import type { AgentStatus, AgentSummary } from '@herdr-roam/shared'
import { Check, Copy, Crosshair, Info, TerminalSquare, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { cn } from '../../../lib/cn'
import type { ResourceRef } from '../../../workbench/resource'
import { focusAgentInHerdr } from '../client'
import { useAgentRuntime } from '../runtime-provider'
import { PromptComposer } from './prompt-composer'
import { TerminalOutput } from './terminal-output'

const statusClasses: Readonly<Record<AgentStatus, string>> = {
  blocked: 'bg-warning',
  working: 'bg-primary',
  idle: 'bg-muted',
  done: 'bg-success',
  unknown: 'bg-faint',
}

const Details = ({
  agent,
  id,
  onClose,
}: {
  readonly agent: AgentSummary
  readonly id: string
  readonly onClose: () => void
}) => (
  <aside className="w-64 flex-none border-border border-l bg-sidebar/40" id={id}>
    <header className="flex h-11 items-center border-border border-b px-4">
      <h2 className="m-0 text-sm font-medium">Agent details</h2>
      <button
        type="button"
        aria-label="Close Agent details"
        className="ml-auto grid size-7 place-items-center rounded-md text-muted hover:bg-hover hover:text-foreground [&_svg]:size-3.5"
        onClick={onClose}
      >
        <X aria-hidden="true" />
      </button>
    </header>
    <dl className="m-0 grid gap-5 px-4 py-5 text-xs [&_dd]:m-0 [&_dd]:mt-1 [&_dd]:break-words [&_dt]:text-faint">
      <div>
        <dt>Status</dt>
        <dd className="capitalize">{agent.status}</dd>
      </div>
      <div>
        <dt>Provider</dt>
        <dd>{agent.provider ?? 'Unknown'}</dd>
      </div>
      <div>
        <dt>Directory</dt>
        <dd className="font-mono text-[0.6875rem] leading-4">{agent.cwd ?? 'Unavailable'}</dd>
      </div>
      <div>
        <dt>Runtime target</dt>
        <dd className="font-mono text-[0.6875rem]">{agent.attachTarget}</dd>
      </div>
    </dl>
  </aside>
)

const unavailableMessage = (
  current: AgentSummary | undefined,
  source: ReturnType<typeof useAgentRuntime>['snapshot']['source'],
  stale: boolean,
): string => {
  if (!current) return 'This Agent is no longer present in Herdr.'
  if (source.state !== 'connected') return source.message
  return stale ? 'Agent runtime state is stale.' : ''
}

export const AgentTab = ({
  resource,
}: {
  readonly resource: Extract<ResourceRef, { type: 'agent' }>
}) => {
  const { snapshot, agentById } = useAgentRuntime()
  const current = agentById(resource.agentId)
  const [lastAgent, setLastAgent] = useState<AgentSummary | null>(current ?? null)
  const [copied, setCopied] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [focusing, setFocusing] = useState(false)
  const detailsId = useId()

  useEffect(() => {
    if (current) setLastAgent(current)
  }, [current])

  const agent = current ?? lastAgent
  if (!agent) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <TerminalSquare className="mx-auto mb-4 size-6 text-faint" aria-hidden="true" />
          <h1 className="m-0 text-lg">Agent unavailable</h1>
          <p className="mt-2 text-sm text-muted">{resource.agentId} is not present in Herdr.</p>
        </div>
      </div>
    )
  }

  const runtimeAvailable =
    Boolean(current) && snapshot.source.state === 'connected' && !snapshot.stale
  const runtimeMessage = unavailableMessage(current, snapshot.source, snapshot.stale)
  const attachCommand = `herdr agent attach ${agent.attachTarget}`

  const copyAttachCommand = async () => {
    try {
      await navigator.clipboard.writeText(attachCommand)
      setCopied(true)
      setActionError(null)
      setTimeout(() => setCopied(false), 1_500)
    } catch (error) {
      console.error('Attach command copy failed', error)
      setActionError('The attach command could not be copied.')
    }
  }

  const focusInHerdr = async () => {
    if (!runtimeAvailable || focusing) return
    setFocusing(true)
    setActionError(null)
    try {
      await focusAgentInHerdr(resource.agentId)
    } catch (error) {
      console.error('Agent focus failed', error)
      setActionError(error instanceof Error ? error.message : 'The Agent could not be focused.')
    } finally {
      setFocusing(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-14 flex-none items-center gap-3 border-border border-b px-5">
        <i
          className={cn('size-2 flex-none rounded-full', statusClasses[agent.status])}
          role="img"
          aria-label={agent.status}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="m-0 truncate text-sm font-semibold">{agent.name}</h1>
            <span className="text-xs capitalize text-muted">{agent.status}</span>
            {agent.provider && (
              <span className="rounded-full bg-raised px-2 py-0.5 text-[0.625rem] text-muted">
                {agent.provider}
              </span>
            )}
          </div>
          <p className="mt-1 mb-0 truncate font-mono text-[0.6875rem] text-faint">
            {agent.cwd ?? 'Directory unavailable'}
          </p>
        </div>
        {actionError && (
          <span className="ml-auto text-xs text-danger" role="status">
            {actionError}
          </span>
        )}
        <button
          type="button"
          className={cn(
            'flex h-8 flex-none items-center gap-1.5 rounded-md px-2.5 text-xs text-muted hover:bg-hover hover:text-foreground [&_svg]:size-3.5',
            !actionError && 'ml-auto',
          )}
          disabled={!runtimeAvailable || focusing}
          onClick={() => void focusInHerdr()}
        >
          <Crosshair aria-hidden="true" />
          {focusing ? 'Focusing…' : 'Focus in Herdr'}
        </button>
        <button
          type="button"
          aria-label="Copy attach command"
          className="flex h-8 flex-none items-center gap-1.5 rounded-md px-2.5 text-xs text-muted hover:bg-hover hover:text-foreground [&_svg]:size-3.5"
          onClick={() => void copyAttachCommand()}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy attach'}
        </button>
        <button
          type="button"
          aria-controls={detailsId}
          aria-expanded={detailsOpen}
          className={cn(
            'flex h-8 flex-none items-center gap-1.5 rounded-md px-2.5 text-xs text-muted hover:bg-hover hover:text-foreground [&_svg]:size-3.5',
            detailsOpen && 'bg-raised text-foreground',
          )}
          onClick={() => setDetailsOpen(open => !open)}
        >
          <Info aria-hidden="true" />
          Details
        </button>
      </header>
      {!runtimeAvailable && (
        <div className="border-warning/30 border-b bg-warning/8 px-5 py-2 text-xs text-muted">
          {runtimeMessage}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <TerminalOutput agentId={resource.agentId} canRead={runtimeAvailable} />
          <PromptComposer
            agentId={resource.agentId}
            status={agent.status}
            runtimeAvailable={runtimeAvailable}
            unavailableMessage={runtimeMessage}
          />
        </div>
        {detailsOpen && (
          <Details agent={agent} id={detailsId} onClose={() => setDetailsOpen(false)} />
        )}
      </div>
    </div>
  )
}
