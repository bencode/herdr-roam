import type { AgentStatus, AgentSummary, Project } from '@herdr-roam/shared'
import { Check, Copy, MessageSquare, PanelRight, TerminalSquare } from 'lucide-react'
import { lazy, Suspense, useEffect, useId, useState } from 'react'
import { cn } from '../../../lib/cn'
import { Button } from '../../../ui/button'
import type { ResourceRef } from '../../../workbench/resource'
import { stopAgent } from '../client'
import { agentProviderLabel } from '../presentation'
import { useAgentRuntime } from '../runtime-provider'
import { AgentStopControl } from '../stop-control'
import { useAgentSessionResource } from '../use-agent-session-resource'
import { AgentDetails } from './details'

const BrowserTerminal = lazy(() =>
  import('../browser-terminal').then(module => ({ default: module.BrowserTerminal })),
)

const statusClasses: Readonly<Record<AgentStatus, string>> = {
  blocked: 'bg-warning',
  working: 'bg-primary',
  idle: 'bg-muted',
  done: 'bg-success',
  unknown: 'bg-faint',
}

const EMPTY_PROJECTS: readonly Project[] = []

const unavailableMessage = (
  current: AgentSummary | undefined,
  source: ReturnType<typeof useAgentRuntime>['snapshot']['source'],
  stale: boolean,
): string => {
  if (!current) return 'This Agent has stopped and is no longer present in Herdr.'
  if (source.state !== 'connected') return source.message
  return stale ? 'Agent runtime state is stale.' : ''
}

export const AgentTab = ({
  resource,
  projects = EMPTY_PROJECTS,
  onOpen = () => undefined,
  active = true,
}: {
  readonly resource: Extract<ResourceRef, { type: 'agent' }>
  readonly projects?: readonly Project[]
  readonly onOpen?: (resource: ResourceRef) => void
  readonly active?: boolean
}) => {
  const { snapshot, agentById } = useAgentRuntime()
  const current = agentById(resource.agentId)
  const [lastAgent, setLastAgent] = useState<AgentSummary | null>(current ?? null)
  const [copied, setCopied] = useState<'attach' | 'working-directory' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [terminalControls, setTerminalControls] = useState<HTMLDivElement | null>(null)
  const [stopping, setStopping] = useState(false)
  const [stopAccepted, setStopAccepted] = useState(false)
  const detailsId = useId()

  useEffect(() => {
    if (current) setLastAgent(current)
  }, [current])

  const agent = current ?? lastAgent
  const sessionLink = useAgentSessionResource(projects, agent?.cwd ?? null, agent?.session ?? null)
  const sessionResource = sessionLink.resource

  useEffect(() => {
    if (!stopAccepted || current) return
    setStopAccepted(false)
    setStopping(false)
    if (sessionResource) onOpen(sessionResource)
  }, [current, onOpen, sessionResource, stopAccepted])

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
  const providerLabel = agentProviderLabel(agent.provider)

  const copyText = async (
    text: string,
    target: 'attach' | 'working-directory',
    errorMessage: string,
  ) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(target)
      setActionError(null)
      setTimeout(
        () => setCopied(currentTarget => (currentTarget === target ? null : currentTarget)),
        1_500,
      )
    } catch (error) {
      console.error(`${target} copy failed`, error)
      setActionError(errorMessage)
    }
  }

  const stop = async () => {
    if (!current || stopping) return
    setStopping(true)
    setActionError(null)
    try {
      await stopAgent(current.id)
      setStopAccepted(true)
    } catch (error) {
      console.error('Agent stop failed', error)
      setStopping(false)
      setActionError(error instanceof Error ? error.message : 'The Agent could not be stopped.')
    }
  }

  const displayedStatus = current ? agent.status : 'stopped'

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex min-h-14 flex-none items-center gap-3 border-border border-b px-5">
        <i
          className={cn(
            'size-2 flex-none rounded-full',
            current ? statusClasses[agent.status] : 'bg-faint',
          )}
          role="img"
          aria-label={displayedStatus}
        />
        <div className="mr-auto min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="m-0 truncate text-sm font-semibold">{agent.name}</h1>
            <span className="text-xs capitalize text-muted">{displayedStatus}</span>
            {providerLabel && (
              <span className="rounded-full bg-raised px-2 py-0.5 text-[0.625rem] text-muted">
                {providerLabel}
              </span>
            )}
          </div>
          <p
            className="mt-1 mb-0 truncate font-mono text-[0.6875rem] text-faint"
            title={agent.cwd ?? undefined}
          >
            {agent.cwd ?? 'Working directory unavailable'}
          </p>
        </div>
        {actionError && (
          <span className="ml-auto text-xs text-danger" role="status">
            {actionError}
          </span>
        )}
        <div ref={setTerminalControls} className="flex flex-none items-center gap-2 text-xs" />
        {sessionResource && (
          <Button
            className={cn('flex-none', !actionError && 'ml-auto')}
            onClick={() => onOpen(sessionResource)}
          >
            <MessageSquare aria-hidden="true" />
            Open Session
          </Button>
        )}
        {current && (
          <AgentStopControl
            status={agent.status}
            stopping={stopping}
            disabled={!runtimeAvailable}
            historyAvailable={Boolean(sessionResource)}
            onStop={() => void stop()}
          />
        )}
        <Button
          aria-label="Copy attach command"
          className="flex-none"
          onClick={() =>
            void copyText(attachCommand, 'attach', 'The attach command could not be copied.')
          }
        >
          {copied === 'attach' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied === 'attach' ? 'Copied' : 'Copy attach'}
        </Button>
        <Button
          size="defaultIcon"
          aria-label={detailsOpen ? 'Hide Agent details' : 'Show Agent details'}
          title={detailsOpen ? 'Hide Agent details' : 'Show Agent details'}
          aria-controls={detailsId}
          aria-expanded={detailsOpen}
          className="ml-2 flex-none border-border border-l rounded-none pl-2"
          data-state={detailsOpen ? 'open' : 'closed'}
          onClick={() => setDetailsOpen(open => !open)}
        >
          <PanelRight aria-hidden="true" />
        </Button>
      </header>
      {sessionLink.error && (
        <div
          className="flex items-center gap-2 border-border border-b px-5 py-2 text-xs text-danger"
          role="status"
        >
          <span>{sessionLink.error}</span>
          <Button size="compact" onClick={sessionLink.retry}>
            Retry Session link
          </Button>
        </div>
      )}
      {!runtimeAvailable && (
        <div className="border-warning/30 border-b bg-warning/8 px-5 py-2 text-xs text-muted">
          {runtimeMessage}
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {active && (
            <Suspense
              fallback={
                <p className="p-4 text-sm text-muted" role="status">
                  Loading terminal…
                </p>
              }
            >
              <BrowserTerminal
                key={agent.id}
                agentId={agent.id}
                available={runtimeAvailable}
                controlsContainer={terminalControls}
              />
            </Suspense>
          )}
        </div>
        {detailsOpen && (
          <AgentDetails
            agent={agent}
            id={detailsId}
            copiedDirectory={copied === 'working-directory'}
            onCopyDirectory={() => {
              if (!agent.cwd) return
              void copyText(
                agent.cwd,
                'working-directory',
                'The working directory could not be copied.',
              )
            }}
            onClose={() => setDetailsOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
