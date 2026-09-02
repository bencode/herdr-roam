import type { AgentLaunchRecovery, AgentSummary } from '@herdr-roam/shared'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Copy,
  ExternalLink,
  Maximize2,
  MessageSquare,
  Minimize2,
  RotateCcw,
  TerminalSquare,
} from 'lucide-react'
import { Activity, type RefObject, useEffect, useRef, useState } from 'react'
import { cn } from '../../../lib/cn'
import { Button } from '../../../ui/button'
import type { ResourceRef } from '../../../workbench/resource'
import { useAgentRuntime } from '../../agent/runtime-provider'
import { AgentRuntimeSurface } from '../../agent/runtime-surface'
import { AgentStopControl } from '../../agent/stop-control'
import { stopAgent } from '../../agent/client'
import { resumeSession, SessionClientError } from '../client'
import { type SessionDataState, useSessionData } from '../use-session-data'
import { SessionTranscript } from './transcript'

const statusClasses: Readonly<Record<AgentSummary['status'], string>> = {
  blocked: 'bg-warning',
  working: 'bg-primary',
  idle: 'bg-muted',
  done: 'bg-success',
  unknown: 'bg-faint',
}

type SessionResource = Extract<ResourceRef, { type: 'session' }>
type SessionView = 'history' | 'live'
type ResumeFailure = {
  readonly message: string
  readonly recovery: AgentLaunchRecovery | null
}

const matchesSession = (agent: AgentSummary, resource: SessionResource): boolean =>
  agent.session?.kind === 'id' &&
  agent.session.agent === resource.provider &&
  agent.session.value === resource.sessionId

const HistoryPanel = ({
  data,
  provider,
  transcript,
}: {
  readonly data: SessionDataState
  readonly provider: SessionResource['provider']
  readonly transcript: RefObject<HTMLDivElement | null>
}) => {
  if (data.loading && !data.value) {
    return <p className="grid h-full place-items-center text-muted">Loading Session history…</p>
  }
  if (!data.value) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <MessageSquare className="mx-auto mb-4 size-6 text-faint" aria-hidden="true" />
          <h2 className="m-0 text-lg">Session unavailable</h2>
          <p className="mt-2 text-sm text-muted">
            {data.error?.message ?? 'Native Session history could not be found.'}
          </p>
        </div>
      </div>
    )
  }

  const session = data.value
  return (
    <div className="min-h-0 flex-1 overflow-auto" ref={transcript}>
      {data.error && (
        <div
          className="sticky top-0 z-10 border-danger/30 border-b bg-danger/8 px-5 py-2 text-xs text-danger"
          role="status"
        >
          {data.error.message}
        </div>
      )}
      {(session.olderCursor || data.hasNewer) && (
        <nav
          className="sticky top-0 z-10 mx-auto flex h-9 w-[min(960px,calc(100%_-_40px))] items-center gap-1 border-border border-b bg-surface/95 text-xs text-muted backdrop-blur-sm"
          aria-label="Session history pages"
        >
          <button
            type="button"
            className="flex h-7 items-center gap-1 rounded-sm px-2 hover:bg-hover disabled:opacity-40"
            disabled={!session.olderCursor || data.loading}
            onClick={data.loadOlder}
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            Earlier
          </button>
          {data.hasNewer && (
            <>
              <button
                type="button"
                className="ml-auto flex h-7 items-center gap-1 rounded-sm px-2 hover:bg-hover disabled:opacity-40"
                disabled={data.loading}
                onClick={data.loadNewer}
              >
                Newer
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="h-7 rounded-sm px-2 hover:bg-hover disabled:opacity-40"
                disabled={data.loading}
                onClick={data.loadLatest}
              >
                Latest
              </button>
            </>
          )}
          {data.loading && <span className="ml-auto pr-2 text-faint">Loading…</span>}
        </nav>
      )}
      <SessionTranscript entries={session.entries} provider={provider} />
    </div>
  )
}

export const SessionTab = ({
  resource,
  focusMode,
  onFocusModeChange,
  onOpen,
}: {
  readonly resource: SessionResource
  readonly focusMode: boolean
  readonly onFocusModeChange: (focused: boolean) => void
  readonly onOpen: (resource: ResourceRef) => void
}) => {
  const { snapshot } = useAgentRuntime()
  const linkedAgent = snapshot.items.find(agent => matchesSession(agent, resource))
  const [resumedAgent, setResumedAgent] = useState<AgentSummary | null>(null)
  const resumedRuntimeAgent = resumedAgent
    ? snapshot.items.find(agent => agent.id === resumedAgent.id)
    : undefined
  const stoppableAgent = linkedAgent ?? resumedRuntimeAgent
  const agent = linkedAgent ?? resumedRuntimeAgent ?? resumedAgent ?? undefined
  const [view, setView] = useState<SessionView>(linkedAgent ? 'live' : 'history')
  const data = useSessionData(
    resource.projectName,
    resource.provider,
    resource.sessionId,
    view === 'history' && agent?.status === 'working',
  )
  const [resuming, setResuming] = useState(false)
  const [stoppingAgentId, setStoppingAgentId] = useState<string | null>(null)
  const [resumeFailure, setResumeFailure] = useState<ResumeFailure | null>(null)
  const [stopFailure, setStopFailure] = useState<string | null>(null)
  const [copiedAttach, setCopiedAttach] = useState(false)
  const transcript = useRef<HTMLDivElement>(null)
  const previousAgentId = useRef<string | null>(agent?.id ?? null)
  const runtimeAvailable = snapshot.source.state === 'connected' && !snapshot.stale
  const sessionLoaded = data.value !== null

  useEffect(() => {
    if (linkedAgent && resumedAgent?.id === linkedAgent.id) setResumedAgent(null)
  }, [linkedAgent, resumedAgent?.id])

  useEffect(() => {
    const currentAgentId = agent?.id ?? null
    if (!previousAgentId.current && currentAgentId) setView('live')
    if (previousAgentId.current && !currentAgentId) setView('history')
    previousAgentId.current = currentAgentId
  }, [agent?.id])

  useEffect(() => {
    if (!stoppingAgentId || snapshot.items.some(item => item.id === stoppingAgentId)) return
    setStoppingAgentId(null)
    setResumedAgent(null)
    setView('history')
    data.reload()
  }, [data.reload, snapshot.items, stoppingAgentId])

  useEffect(() => {
    if (view !== 'history' || data.loading || !sessionLoaded || !transcript.current) return
    transcript.current.scrollTop = data.navigation === 'newer' ? 0 : transcript.current.scrollHeight
  }, [data.loading, data.navigation, sessionLoaded, view])

  const resume = async () => {
    if (!runtimeAvailable || resuming) return
    setResuming(true)
    setResumeFailure(null)
    setStopFailure(null)
    setCopiedAttach(false)
    try {
      const receipt = await resumeSession(
        resource.projectName,
        resource.provider,
        resource.sessionId,
      )
      setResumedAgent(receipt.agent)
      setView('live')
      data.reload()
    } catch (error) {
      console.error('Session resume failed', error)
      setResumeFailure({
        message: error instanceof Error ? error.message : 'The Session could not be resumed.',
        recovery: error instanceof SessionClientError ? (error.recovery ?? null) : null,
      })
    } finally {
      setResuming(false)
    }
  }

  const stop = async () => {
    if (!stoppableAgent || stoppingAgentId) return
    setStoppingAgentId(stoppableAgent.id)
    setResumeFailure(null)
    setStopFailure(null)
    try {
      await stopAgent(stoppableAgent.id)
    } catch (error) {
      console.error('Session stop failed', error)
      setStoppingAgentId(null)
      setStopFailure(error instanceof Error ? error.message : 'The Agent could not be stopped.')
    }
  }

  const copyAttach = async () => {
    const command = resumeFailure?.recovery?.attachCommand
    if (!command) return
    try {
      await navigator.clipboard.writeText(command)
      setCopiedAttach(true)
      setTimeout(() => setCopiedAttach(false), 1_500)
    } catch (error) {
      console.error('Session recovery command copy failed', error)
      setResumeFailure({ message: 'The recovery command could not be copied.', recovery: null })
    }
  }

  const unavailableMessage =
    snapshot.source.state === 'connected'
      ? snapshot.stale
        ? 'Agent runtime state is stale.'
        : 'This Session is not running.'
      : snapshot.source.message
  const title = data.value?.title ?? agent?.name ?? resource.sessionId
  const cwd = agent?.cwd ?? data.value?.cwd ?? ''
  const recoveryAgentId = resumeFailure?.recovery?.agentId

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex min-h-14 flex-none items-center gap-3 border-border border-b px-5">
        <i
          className={cn(
            'size-2 flex-none rounded-full',
            agent ? statusClasses[agent.status] : 'bg-faint',
          )}
          role="img"
          aria-label={agent?.status ?? 'not running'}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="m-0 truncate text-sm font-semibold">{title}</h1>
            <span className="text-xs capitalize text-muted">{agent?.status ?? 'not running'}</span>
            <span className="rounded-full bg-raised px-2 py-0.5 text-[0.625rem] text-muted capitalize">
              {resource.provider}
            </span>
          </div>
          {cwd && (
            <p className="mt-1 mb-0 truncate font-mono text-[0.6875rem] text-faint" title={cwd}>
              {cwd}
            </p>
          )}
        </div>
        <div className="ml-auto flex flex-none items-center gap-1.5">
          <fieldset className="m-0 flex h-8 items-center rounded-md border-0 bg-raised p-0.5">
            <legend className="sr-only">Session view</legend>
            <button
              type="button"
              className={cn(
                'h-7 rounded-sm px-2.5 text-xs text-muted disabled:cursor-not-allowed disabled:opacity-40',
                view === 'live' && 'bg-surface text-foreground shadow-sm',
              )}
              disabled={!agent}
              aria-pressed={view === 'live'}
              onClick={() => setView('live')}
            >
              Live
            </button>
            <button
              type="button"
              className={cn(
                'h-7 rounded-sm px-2.5 text-xs text-muted',
                view === 'history' && 'bg-surface text-foreground shadow-sm',
              )}
              aria-pressed={view === 'history'}
              onClick={() => setView('history')}
            >
              History
            </button>
          </fieldset>
          {agent ? (
            <AgentStopControl
              status={agent.status}
              stopping={stoppingAgentId === agent.id}
              disabled={!stoppableAgent || !runtimeAvailable}
              historyAvailable
              onStop={() => void stop()}
            />
          ) : (
            data.value && (
              <Button
                aria-label="Resume Session"
                disabled={!runtimeAvailable || resuming}
                variant="primary"
                onClick={() => void resume()}
              >
                <RotateCcw aria-hidden="true" />
                {resuming ? 'Resuming…' : 'Resume'}
              </Button>
            )
          )}
          {agent && (
            <Button
              onClick={() => onOpen({ type: 'agent', agentId: agent.id })}
            >
              <TerminalSquare aria-hidden="true" />
              Open Agent
            </Button>
          )}
          <Button
            size="defaultIcon"
            aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
            aria-pressed={focusMode}
            data-state={focusMode ? 'open' : 'closed'}
            title={focusMode ? 'Exit focus mode (Esc)' : 'Enter focus mode'}
            onClick={() => onFocusModeChange(!focusMode)}
          >
            {focusMode ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
          </Button>
        </div>
      </header>

      {resumeFailure && (
        <div
          className="flex min-h-10 flex-none items-center gap-2 border-danger/30 border-b bg-danger/8 px-5 py-2 text-xs"
          role="alert"
        >
          <CircleAlert className="size-3.5 flex-none text-danger" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-danger">
            {resumeFailure.message}
            {resumeFailure.recovery && ' The Herdr Workspace was kept for recovery.'}
          </span>
          {recoveryAgentId && (
            <Button
              size="compact"
              onClick={() => onOpen({ type: 'agent', agentId: recoveryAgentId })}
            >
              <ExternalLink aria-hidden="true" />
              Open Agent
            </Button>
          )}
          {resumeFailure.recovery && (
            <Button size="compact" onClick={() => void copyAttach()}>
              {copiedAttach ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copiedAttach ? 'Copied' : 'Copy attach'}
            </Button>
          )}
        </div>
      )}

      {stopFailure && (
        <div
          className="flex min-h-10 flex-none items-center gap-2 border-danger/30 border-b bg-danger/8 px-5 py-2 text-xs"
          role="alert"
        >
          <CircleAlert className="size-3.5 flex-none text-danger" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-danger">{stopFailure}</span>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <Activity mode={view === 'history' ? 'visible' : 'hidden'} name="session-history">
          <div className="absolute inset-0 flex min-h-0 flex-col">
            <HistoryPanel data={data} provider={resource.provider} transcript={transcript} />
          </div>
        </Activity>
        <Activity mode={view === 'live' && agent ? 'visible' : 'hidden'} name="session-live">
          <div className="absolute inset-0 flex min-h-0 flex-col bg-background">
            {agent && (
              <AgentRuntimeSurface
                agent={agent}
                runtimeAvailable={runtimeAvailable}
                unavailableMessage={unavailableMessage}
                onSubmitted={data.reload}
              />
            )}
          </div>
        </Activity>
      </div>
    </div>
  )
}
