import type { AgentLaunchRecovery, AgentSummary } from '@herdr-roam/shared'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  MessageSquare,
  RotateCcw,
  TerminalSquare,
} from 'lucide-react'
import { type RefObject, useEffect, useRef, useState } from 'react'
import { cn } from '../../../lib/cn'
import { Badge } from '../../../ui/badge'
import { Banner } from '../../../ui/banner'
import { Button } from '../../../ui/button'
import { DetailHeader } from '../../../ui/detail-header'
import { EmptyState } from '../../../ui/empty-state'
import type { ResourceRef } from '../../../workbench/resource'
import { useAgentRuntime } from '../../agent/runtime-provider'
import { StatusDot } from '../../agent/status-dot'
import { useAssistantStore } from '../../assistant/store'
import { resumeSession, SessionClientError } from '../client'
import { type SessionDataState, useSessionData } from '../use-session-data'
import styles from './style.module.scss'
import { SessionTranscript } from './transcript'

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
    return (
      <p className="m-0 grid h-full place-items-center text-xs text-muted" role="status">
        Loading Session history…
      </p>
    )
  }
  if (!data.value) {
    return (
      <EmptyState
        className="h-full content-center"
        icon={<MessageSquare aria-hidden="true" />}
        title="Session unavailable"
      >
        {data.error?.message ?? 'Native Session history could not be found.'}
      </EmptyState>
    )
  }

  const session = data.value
  return (
    <div className="min-h-0 flex-1 overflow-auto" ref={transcript}>
      {data.error && (
        <Banner tone="danger" className="sticky top-0 z-10 px-5">
          {data.error.message}
        </Banner>
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
}: {
  readonly resource: SessionResource
  readonly active?: boolean
}) => {
  const { snapshot } = useAgentRuntime()
  const openAgent = useAssistantStore(state => state.openAgent)
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
      if (resumeNavigation.current) openAgent(receipt.agent.id)
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
      <DetailHeader
        icon={
          <StatusDot
            status={agent?.status ?? null}
            label={agent?.status ?? 'not running'}
            className="size-2"
          />
        }
        title={title}
        detail={cwd || undefined}
        meta={
          <>
            <span className="capitalize">{agent?.status ?? 'not running'}</span>
            <Badge className="capitalize">{resource.provider}</Badge>
          </>
        }
        actions={
          <>
            {!agent && data.value && (
              <Button
                size="compact"
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
              <Button size="compact" onClick={() => openAgent(agent.id)}>
                <TerminalSquare aria-hidden="true" />
                Open Agent
              </Button>
            )}
          </>
        }
      />

      {resumeFailure && (
        <Banner
          tone="danger"
          className="flex-none px-5"
          action={
            <>
              {recoveryAgentId && (
                <Button size="compact" onClick={() => openAgent(recoveryAgentId)}>
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
            </>
          }
        >
          {resumeFailure.message}
          {resumeFailure.recovery && ' The Herdr Workspace was kept for recovery.'}
        </Banner>
      )}

      <HistoryPanel data={data} provider={resource.provider} transcript={transcript} />
    </div>
  )
}
