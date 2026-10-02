import type { AgentStatus, AgentSummary, Project } from '@herdr-roam/shared'
import { Bot } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../../ui/button'
import { useAgentRuntime } from '../agent/runtime-provider'
import { AssistantComposer } from './composer'
import { AssistantSessionView } from './session-view'
import { useAssistantAgent } from './use-assistant-agent'

const statusClasses: Readonly<Record<AgentStatus, string>> = {
  blocked: 'bg-warning',
  working: 'bg-primary',
  idle: 'bg-muted',
  done: 'bg-success',
  unknown: 'bg-faint',
}

const agentLabel = (agent: AgentSummary): string =>
  agent.provider ? `${agent.name} · ${agent.provider}` : agent.name

const Empty = ({ children }: { readonly children: ReactNode }) => (
  <div className="grid min-h-0 flex-1 place-items-center p-6 text-center text-sm text-muted">
    <div>{children}</div>
  </div>
)

export const AssistantPanel = ({
  projectName,
  projects,
}: {
  readonly projectName: string
  readonly projects: readonly Project[]
}) => {
  const { snapshot } = useAgentRuntime()
  const assistant = useAssistantAgent(projectName)
  const runtimeAvailable = snapshot.source.state === 'connected' && !snapshot.stale
  const { agent, agents } = assistant

  const body = !projectName ? (
    <Empty>Select a Project to ask its Agents.</Empty>
  ) : assistant.error ? (
    <Empty>
      <p className="m-0">{assistant.error.message}</p>
      <Button className="mt-3" size="compact" onClick={assistant.retry}>
        Retry
      </Button>
    </Empty>
  ) : assistant.loading && agents.length === 0 ? (
    <Empty>Loading Agents…</Empty>
  ) : agents.length === 0 ? (
    <Empty>No Agent is running in {projectName}. Start one to ask about documents here.</Empty>
  ) : !agent ? (
    <Empty>Choose an Agent above to start asking.</Empty>
  ) : (
    <>
      <AssistantSessionView agent={agent} projects={projects} />
      <AssistantComposer
        key={agent.id}
        agentId={agent.id}
        status={agent.status}
        runtimeAvailable={runtimeAvailable}
      />
    </>
  )

  return (
    <section className="flex h-full min-h-0 flex-col bg-surface" aria-label="Assistant">
      <header className="flex h-10 flex-none items-center gap-2 border-border border-b px-3">
        <Bot className="size-3.5 flex-none text-faint" aria-hidden="true" />
        {agent && (
          <i
            className={cn('size-1.5 flex-none rounded-full', statusClasses[agent.status])}
            role="img"
            aria-label={agent.status}
          />
        )}
        {agents.length > 0 ? (
          <select
            className="min-w-0 flex-1 truncate rounded-sm border-0 bg-transparent py-1 text-xs text-foreground outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Assistant Agent"
            value={agent?.id ?? ''}
            onChange={event => assistant.select(event.target.value)}
          >
            {!agent && (
              <option value="" disabled>
                Choose an Agent…
              </option>
            )}
            {agents.map(item => (
              <option key={item.id} value={item.id}>
                {agentLabel(item)} ({item.status})
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-muted">Assistant</span>
        )}
      </header>
      {body}
    </section>
  )
}
