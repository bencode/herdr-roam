import type { AgentSummary, Project } from '@herdr-roam/shared'
import { type ReactNode, useLayoutEffect, useRef } from 'react'
import { Button } from '../../ui/button'
import type { ResourceRef } from '../../workbench/resource'
import { useAgentSessionResource } from '../agent/use-agent-session-resource'
import { SessionTranscript } from '../session/session-tab/transcript'
import { useLiveSession } from '../session/use-live-session'

type SessionResource = Extract<ResourceRef, { type: 'session' }>

const BOTTOM_THRESHOLD = 32

const Notice = ({ children }: { readonly children: ReactNode }) => (
  <div className="grid min-h-0 flex-1 place-items-center p-6 text-center text-sm text-muted">
    <div>{children}</div>
  </div>
)

const LiveTranscript = ({
  resource,
  agent,
}: {
  readonly resource: SessionResource
  readonly agent: AgentSummary
}) => {
  const data = useLiveSession(resource, agent.status, true)
  const scroller = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const entries = data.value?.entries

  useLayoutEffect(() => {
    const node = scroller.current
    if (node && entries && pinned.current) node.scrollTop = node.scrollHeight
  }, [entries])

  if (!data.value && data.error?.code === 'session_not_found') {
    return <Notice>No messages yet. Replies appear here after the Agent answers.</Notice>
  }
  if (!data.value) {
    return (
      <Notice>
        {data.loading ? (
          'Loading Session…'
        ) : (
          <>
            <p className="m-0">{data.error?.message ?? 'Session history could not be found.'}</p>
            <Button className="mt-3" size="compact" onClick={data.reload}>
              Retry
            </Button>
          </>
        )}
      </Notice>
    )
  }

  return (
    <div
      className="min-h-0 flex-1 overflow-auto"
      ref={scroller}
      onScroll={event => {
        const node = event.currentTarget
        pinned.current = node.scrollHeight - node.scrollTop - node.clientHeight < BOTTOM_THRESHOLD
      }}
    >
      {data.error && (
        <div
          className="sticky top-0 z-10 border-danger/30 border-b bg-danger/8 px-3 py-2 text-xs text-danger"
          role="status"
        >
          {data.error.message}
        </div>
      )}
      <SessionTranscript entries={data.value.entries} provider={resource.provider} />
    </div>
  )
}

export const AssistantSessionView = ({
  agent,
  projects,
}: {
  readonly agent: AgentSummary
  readonly projects: readonly Project[]
}) => {
  const session = useAgentSessionResource(projects, agent.cwd, agent.session)

  if (session.resource) {
    return <LiveTranscript resource={session.resource} agent={agent} />
  }
  if (session.error) {
    return (
      <Notice>
        <p className="m-0">{session.error}</p>
        <Button className="mt-3" size="compact" onClick={session.retry}>
          Retry
        </Button>
      </Notice>
    )
  }
  const resolvable =
    agent.session?.kind === 'id' &&
    (agent.session.agent === 'claude' || agent.session.agent === 'codex')
  if (resolvable) return <Notice>Loading Session…</Notice>
  return (
    <Notice>
      <p className="m-0">Herdr has not reported a Session for this Agent.</p>
      <p className="mt-2 mb-0 text-xs">
        Messages can still be sent; replies appear in the Agent Terminal. Herdr reports Sessions
        when its integration is installed
        {agent.provider ? (
          <>
            {' '}
            (<code>herdr integration install {agent.provider}</code>)
          </>
        ) : null}
        .
      </p>
    </Notice>
  )
}
