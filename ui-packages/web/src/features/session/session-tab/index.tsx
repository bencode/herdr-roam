import type { AgentLaunchRecovery, AgentSummary } from '@herdr-roam/shared'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Copy,
  ExternalLink,
  MessageSquare,
  RotateCcw,
  TerminalSquare,
} from 'lucide-react'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { cn } from '../../../lib/cn'
import { Button } from '../../../ui/button'
import type { ResourceRef } from '../../../workbench/resource'
import { useAgentRuntime } from '../../agent/runtime-provider'
import { resumeSession, SessionClientError } from '../client'
import { type SessionDataState, useSessionData } from '../use-session-data'
import styles from './style.module.scss'
import { SessionTranscript } from './transcript'

const statusClasses: Readonly<Record<AgentSummary['status'], string>> = {
  blocked: 'bg-warning',
  working: 'bg-primary',
  idle: 'bg-muted',
  done: 'bg-success',
  unknown: 'bg-faint',
}

type SessionResource = Extract<ResourceRef, { type: 'session' }>
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
          className={cn(
            styles.readingColumn,
            styles.historyNavigation,
            data.hasNewer && !data.loading && styles.historyNavigationPaged,
          )}
          aria-label="Session history pages"
        >
          {data.loading ? (
            <span className="text-xs text-faint" role="status">
              Loading messages…
            </span>
          ) : (
            <>
              {session.olderCursor && (
                <Button size="compact" onClick={data.loadOlder}>
                  <ChevronLeft aria-hidden="true" />
                  {data.hasNewer ? 'Earlier' : 'Load earlier messages'}
                </Button>
              )}
              {data.hasNewer && (
                <div className={styles.historyNavigationEnd}>
                  <Button size="compact" onClick={data.loadNewer}>
                    Newer
                    <ChevronRight aria-hidden="true" />
                  </Button>
                  <Button size="compact" onClick={data.loadLatest}>
                    Latest
                  </Button>
                </div>
              )}
            </>
          )}
        </nav>
      )}
      <SessionTranscript entries={session.entries} provider={provider} />
    </div>
  )
}

export const SessionTab = ({
  resource,
  active = true,
  onOpen,
}: {
  readonly resource: SessionResource
  readonly active?: boolean
  readonly onOpen: (resource: ResourceRef) => void
}) => {
  const { snapshot } = useAgentRuntime()
  const linkedAgent = snapshot.items.find(agent => matchesSession(agent, resource))
  const [resumedAgent, setResumedAgent] = useState<AgentSummary | null>(null)
  const resumedRuntimeAgent = resumedAgent
    ? snapshot.items.find(agent => agent.id === resumedAgent.id)
    : undefined
  const agent = linkedAgent ?? resumedRuntimeAgent ?? resumedAgent ?? undefined
  const data = useSessionData(
    resource.projectName,
    resource.provider,
    resource.sessionId,
    active && agent?.status === 'working',
  )
  const [resuming, setResuming] = useState(false)
  const [resumeFailure, setResumeFailure] = useState<ResumeFailure | null>(null)
  const [copiedAttach, setCopiedAttach] = useState(false)
  const transcript = useRef<HTMLDivElement>(null)
  const previousStatus = useRef(agent?.status)
  const resumeNavigation = useRef(false)

  useEffect(() => {
    if (!active) resumeNavigation.current = false
    return () => {
      resumeNavigation.current = false
    }
  }, [active])
  const runtimeAvailable = snapshot.source.state === 'connected' && !snapshot.stale
  const sessionLoaded = data.value !== null

  useEffect(() => {
    if (linkedAgent && resumedAgent?.id === linkedAgent.id) setResumedAgent(null)
  }, [linkedAgent, resumedAgent?.id])

  useEffect(() => {
    if (previousStatus.current === 'working' && agent?.status !== 'working' && !data.hasNewer) {
      data.reload()
    }
    previousStatus.current = agent?.status
  }, [agent?.status, data.hasNewer, data.reload])

  useEffect(() => {
    if (data.loading || !sessionLoaded || !transcript.current) return
    transcript.current.scrollTop = data.navigation === 'newer' ? 0 : transcript.current.scrollHeight
  }, [data.loading, data.navigation, sessionLoaded])

  const resume = async () => {
    if (!runtimeAvailable || resuming) return
    resumeNavigation.current = active
    setResuming(true)
    setResumeFailure(null)
    setCopiedAttach(false)
    try {
      const receipt = await resumeSession(
        resource.projectName,
        resource.provider,
        resource.sessionId,
      )
      setResumedAgent(receipt.agent)
      if (resumeNavigation.current) onOpen({ type: 'agent', agentId: receipt.agent.id })
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
          {!agent && data.value && (
            <Button
              aria-label="Resume Session"
              disabled={!runtimeAvailable || resuming}
              variant="primary"
              onClick={() => void resume()}
            >
              <RotateCcw aria-hidden="true" />
              {resuming ? 'Resuming…' : 'Resume'}
            </Button>
          )}
          {agent && (
            <Button onClick={() => onOpen({ type: 'agent', agentId: agent.id })}>
              <TerminalSquare aria-hidden="true" />
              Open Agent
            </Button>
          )}
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

      <HistoryPanel data={data} provider={resource.provider} transcript={transcript} />
    </div>
  )
}
