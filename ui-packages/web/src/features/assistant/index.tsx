import type { Project } from '@herdr-roam/shared'
import { Maximize2, Minimize2, PanelRightClose, X } from 'lucide-react'
import { type KeyboardEvent, useEffect, useRef } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../../ui/button'
import { EmptyState } from '../../ui/empty-state'
import { tabCloseClass, tabShellVariants, tabTriggerClass } from '../../ui/tab-strip'
import type { ResourceRef } from '../../workbench/resource'
import { AgentPane } from '../agent/agent-pane'
import { useAgentRuntime } from '../agent/runtime-provider'
import { StatusDot } from '../agent/status-dot'
import { AgentMenu } from './agent-menu'
import { AgentTabMenu } from './agent-tab-menu'
import { useAssistantStore } from './store'

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
  const {
    agentIds,
    activeAgentId,
    maximized,
    activate,
    closeAgent,
    closeAgents,
    setOpen,
    setMaximized,
    prune,
  } = useAssistantStore()
  const runtimeCurrent = snapshot.source.state === 'connected' && !snapshot.stale

  useEffect(() => {
    if (runtimeCurrent) prune(new Set(snapshot.items.map(agent => agent.id)))
  }, [prune, runtimeCurrent, snapshot.items])

  const moveFocus = (event: KeyboardEvent<HTMLButtonElement>, agentId: string) => {
    const index = agentIds.indexOf(agentId)
    const targets: Readonly<Record<string, number>> = {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      Home: 0,
      End: agentIds.length - 1,
    }
    const target = targets[event.key]
    if (target === undefined) return
    event.preventDefault()
    const next = agentIds[(target + agentIds.length) % agentIds.length]
    if (!next) return
    activate(next)
    event.currentTarget.parentElement?.parentElement
      ?.querySelector<HTMLButtonElement>(`[data-agent-id="${CSS.escape(next)}"]`)
      ?.focus()
  }

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
              <AgentTabMenu
                key={agentId}
                agentId={agentId}
                agentIds={agentIds}
                agent={agent ?? null}
                onCloseMany={closeAgents}
              >
                <div
                  className={cn(
                    tabShellVariants({ selected }),
                    'min-w-24 max-w-48 flex-none basis-auto max-[68rem]:basis-auto',
                  )}
                  onAuxClick={event => event.button === 1 && closeAgent(agentId)}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    data-agent-id={agentId}
                    onKeyDown={event => moveFocus(event, agentId)}
                    className={tabTriggerClass}
                    onClick={() => activate(agentId)}
                    title={agent?.cwd ? `${name} · ${agent.cwd}` : name}
                  >
                    <StatusDot
                      status={agent?.status ?? null}
                      label={agent?.status ?? 'unavailable'}
                    />
                    <span className="truncate">{name}</span>
                  </button>
                  <button
                    type="button"
                    className={tabCloseClass}
                    aria-label={`Close ${name}`}
                    title={`Close ${name} (keeps the Agent running)`}
                    onClick={() => closeAgent(agentId)}
                  >
                    <X aria-hidden="true" />
                  </button>
                </div>
              </AgentTabMenu>
            )
          })}
        </div>
        <div className="flex flex-none items-center gap-0.5 px-1">
          <AgentMenu projectName={projectName} />
          <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
          <Button
            size="compactIcon"
            aria-label={maximized ? 'Restore Assistant' : 'Maximize Assistant'}
            title={maximized ? 'Restore Assistant' : 'Maximize Assistant'}
            onClick={() => setMaximized(!maximized)}
          >
            {maximized ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
          </Button>
          <Button
            size="compactIcon"
            aria-label="Close Assistant"
            title="Close Assistant"
            onClick={() => setOpen(false)}
          >
            <PanelRightClose aria-hidden="true" />
          </Button>
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
        <EmptyState className="min-h-0 flex-1 content-center">
          Open an Agent from the Agents list or with +.
        </EmptyState>
      )}
    </section>
  )
}
