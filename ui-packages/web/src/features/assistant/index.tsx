import type { AgentStatus, Project } from '@herdr-roam/shared'
import { Maximize2, Minimize2, PanelRightClose, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'
import type { ResourceRef } from '../../workbench/resource'
import { AgentPane } from '../agent/agent-pane'
import { useAgentRuntime } from '../agent/runtime-provider'
import { AgentMenu } from './agent-menu'
import { useAssistantStore } from './store'

const statusClasses: Readonly<Record<AgentStatus, string>> = {
  blocked: 'bg-warning',
  working: 'bg-primary',
  idle: 'bg-muted',
  done: 'bg-success',
  unknown: 'bg-faint',
}

const iconButtonClass =
  'grid size-7 flex-none place-items-center rounded-sm border-0 bg-transparent text-muted hover:bg-hover hover:text-foreground [&_svg]:size-3.5'

export const AssistantPanel = ({
  projectName,
  projects,
  onOpen,
}: {
  readonly projectName: string
  readonly projects: readonly Project[]
  readonly onOpen: (resource: ResourceRef) => void
}) => {
  const { snapshot, agentById } = useAgentRuntime()
  const knownNames = useRef(new Map<string, string>())
  const { agentIds, activeAgentId, maximized, activate, closeAgent, setOpen, setMaximized, prune } =
    useAssistantStore()
  const runtimeCurrent = snapshot.source.state === 'connected' && !snapshot.stale

  useEffect(() => {
    if (runtimeCurrent) prune(new Set(snapshot.items.map(agent => agent.id)))
  }, [prune, runtimeCurrent, snapshot.items])

  return (
    <section className="flex h-full min-h-0 flex-col bg-surface" aria-label="Assistant">
      <header className="flex h-10 flex-none items-stretch border-border border-b bg-sidebar">
        <div
          className="flex min-w-0 flex-1 items-stretch overflow-x-auto"
          role="tablist"
          aria-label="Assistant Agents"
        >
          {agentIds.map(agentId => {
            const agent = agentById(agentId)
            const selected = agentId === activeAgentId
            if (agent) knownNames.current.set(agentId, agent.name)
            const name = knownNames.current.get(agentId) ?? agentId
            return (
              <div
                key={agentId}
                className={cn(
                  'group flex min-w-24 max-w-48 flex-none items-stretch border-border border-r text-muted',
                  selected && 'bg-surface text-foreground shadow-[inset_0_2px_var(--foreground)]',
                )}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className="flex min-w-0 flex-1 items-center gap-1.75 border-0 bg-transparent pr-1 pl-2.5 text-left text-xs text-inherit hover:text-foreground"
                  onClick={() => activate(agentId)}
                  title={agent?.cwd ? `${name} · ${agent.cwd}` : name}
                >
                  <i
                    className={cn(
                      'size-1.5 flex-none rounded-full',
                      agent ? statusClasses[agent.status] : 'bg-faint',
                    )}
                    role="img"
                    aria-label={agent?.status ?? 'unavailable'}
                  />
                  <span className="truncate">{name}</span>
                </button>
                <button
                  type="button"
                  className="grid size-6 flex-none place-items-center self-center rounded-sm border-0 bg-transparent text-muted opacity-0 hover:bg-hover hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 [&>svg]:w-3"
                  aria-label={`Close ${name}`}
                  title={`Close ${name} (keeps the Agent running)`}
                  onClick={() => closeAgent(agentId)}
                >
                  <X aria-hidden="true" />
                </button>
              </div>
            )
          })}
        </div>
        <div className="flex flex-none items-center gap-0.5 px-1">
          <AgentMenu projectName={projectName} />
          <button
            type="button"
            className={iconButtonClass}
            aria-label={maximized ? 'Restore Assistant' : 'Maximize Assistant'}
            title={maximized ? 'Restore Assistant' : 'Maximize Assistant'}
            onClick={() => setMaximized(!maximized)}
          >
            {maximized ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
          </button>
          <button
            type="button"
            className={iconButtonClass}
            aria-label="Close Assistant"
            title="Close Assistant"
            onClick={() => setOpen(false)}
          >
            <PanelRightClose aria-hidden="true" />
          </button>
        </div>
      </header>
      {activeAgentId ? (
        <div className="min-h-0 flex-1">
          <AgentPane
            key={activeAgentId}
            agentId={activeAgentId}
            projects={projects}
            onOpen={onOpen}
          />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 place-items-center p-6 text-center text-sm text-muted">
          Open an Agent from the Agents list or with +.
        </div>
      )}
    </section>
  )
}
