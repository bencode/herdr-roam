import type { AgentSummary, Project } from '@herdr-roam/shared'
import { Check, Copy, MessageSquare, TerminalSquare, TriangleAlert } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Banner } from '../../../ui/banner'
import { Button } from '../../../ui/button'
import { EmptyState } from '../../../ui/empty-state'
import type { ResourceRef } from '../../../workbench/resource'
import { stopAgent } from '../client'
import { agentAttachCommand, agentProviderLabel } from '../presentation'
import { useAgentRuntime } from '../runtime-provider'
import { StatusDot } from '../status-dot'
import { AgentStopControl } from '../stop-control'
import { useAgentSessionResource } from '../use-agent-session-resource'
import { AgentDetails } from './details'

const BrowserTerminal = lazy(() =>
  import('../browser-terminal').then(module => ({ default: module.BrowserTerminal })),
)

const EMPTY_PROJECTS: readonly Project[] = []

const compactPath = (cwd: string | null): string | null =>
  cwd?.replace(/^\/(?:Users|home)\/[^/]+(?=\/|$)/, '~') ?? null

const unavailableMessage = (
  current: AgentSummary | undefined,
  source: ReturnType<typeof useAgentRuntime>['snapshot']['source'],
  stale: boolean,
): string => {
  if (!current) return 'This Agent has stopped and is no longer present in Herdr.'
  if (source.state !== 'connected') return source.message
  return stale ? 'Agent runtime state is stale.' : ''
}

export const AgentPane = ({
  agentId,
  projects = EMPTY_PROJECTS,
  onOpen = () => undefined,
}: {
  readonly agentId: string
  readonly projects?: readonly Project[]
  readonly onOpen?: (resource: ResourceRef) => void
}) => {
  const { snapshot, agentById } = useAgentRuntime()
  const current = agentById(agentId)
  const [lastAgent, setLastAgent] = useState<AgentSummary | null>(current ?? null)
  const [copied, setCopied] = useState<'attach' | 'working-directory' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [stopping, setStopping] = useState(false)
  const [stopAccepted, setStopAccepted] = useState(false)

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
      <EmptyState
        className="h-full content-center"
        icon={<TerminalSquare aria-hidden="true" />}
        title="Agent unavailable"
      >
        {agentId} is not present in Herdr.
      </EmptyState>
    )
  }

  const runtimeAvailable =
    Boolean(current) && snapshot.source.state === 'connected' && !snapshot.stale
  const runtimeMessage = unavailableMessage(current, snapshot.source, snapshot.stale)
  const attachCommand = agentAttachCommand(agent)
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
  const summary = [displayedStatus, providerLabel, compactPath(agent.cwd)]
    .filter(value => value !== null)
    .join(' · ')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-8 flex-none items-center gap-1 border-border border-b pr-1.5 pl-3">
        <StatusDot status={current ? agent.status : null} label={displayedStatus} />
        <p
          className="m-0 ml-1 min-w-0 flex-1 truncate text-xs text-muted first-letter:uppercase"
          title={agent.cwd ?? 'Working directory unavailable'}
        >
          {summary}
        </p>
        {actionError && (
          <span className="max-w-48 truncate text-xs text-danger" role="status" title={actionError}>
            {actionError}
          </span>
        )}
        {sessionLink.error && (
          <Button
            size="compactIcon"
            className="flex-none text-warning"
            aria-label="Retry Session link"
            title={`${sessionLink.error} Retry Session link.`}
            onClick={sessionLink.retry}
          >
            <TriangleAlert aria-hidden="true" />
          </Button>
        )}
        {sessionResource && (
          <Button
            size="compactIcon"
            aria-label="Open Session"
            title="Open Session"
            className="flex-none"
            onClick={() => onOpen(sessionResource)}
          >
            <MessageSquare aria-hidden="true" />
          </Button>
        )}
        <Button
          size="compactIcon"
          aria-label="Copy attach command"
          title={copied === 'attach' ? 'Copied' : 'Copy attach command'}
          className="flex-none"
          onClick={() =>
            void copyText(attachCommand, 'attach', 'The attach command could not be copied.')
          }
        >
          {copied === 'attach' ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </Button>
        {current && (
          <AgentStopControl
            status={agent.status}
            stopping={stopping}
            disabled={!runtimeAvailable}
            historyAvailable={Boolean(sessionResource)}
            onStop={() => void stop()}
          />
        )}
        <AgentDetails
          agent={agent}
          copiedDirectory={copied === 'working-directory'}
          onCopyDirectory={() => {
            if (!agent.cwd) return
            void copyText(
              agent.cwd,
              'working-directory',
              'The working directory could not be copied.',
            )
          }}
        />
      </header>
      {!runtimeAvailable && <Banner tone="warning">{runtimeMessage}</Banner>}
      <div className="flex min-h-0 flex-1 flex-col">
        <Suspense
          fallback={
            <p className="m-0 p-4 text-xs text-muted" role="status">
              Loading terminal…
            </p>
          }
        >
          <BrowserTerminal key={agent.id} agentId={agent.id} available={runtimeAvailable} />
        </Suspense>
      </div>
    </div>
  )
}
