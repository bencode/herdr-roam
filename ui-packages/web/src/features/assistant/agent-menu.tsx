import type { AgentProvider } from '@herdr-roam/shared'
import * as Popover from '@radix-ui/react-popover'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { AgentClientError, launchProjectAgent } from '../agent/client'
import { agentDirectoryLabel, agentProviderLabel } from '../agent/presentation'
import { useAgentRuntime } from '../agent/runtime-provider'
import { StatusDot } from '../agent/status-dot'
import { useAssistantStore } from './store'

const providers: readonly AgentProvider[] = ['claude', 'codex']

const optionClass =
  'flex w-full items-start gap-2 rounded-sm border-0 bg-transparent px-2 py-1.5 text-left text-xs hover:bg-hover disabled:cursor-not-allowed disabled:opacity-60'

type Failure = { readonly message: string; readonly agentId: string | null }

export const AgentMenu = ({ projectName }: { readonly projectName: string }) => {
  const { snapshot, registerStartedAgent } = useAgentRuntime()
  const agentIds = useAssistantStore(state => state.agentIds)
  const openAgent = useAssistantStore(state => state.openAgent)
  const [open, setOpen] = useState(false)
  const [launching, setLaunching] = useState<AgentProvider | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const available = snapshot.items.filter(agent => !agentIds.includes(agent.id))
  const runtimeAvailable = snapshot.source.state === 'connected' && !snapshot.stale

  const attach = (agentId: string) => {
    openAgent(agentId)
    setOpen(false)
  }

  const launch = async (provider: AgentProvider) => {
    if (launching) return
    setLaunching(provider)
    setFailure(null)
    try {
      const receipt = await launchProjectAgent({ projectName, provider })
      registerStartedAgent(receipt.agent)
      attach(receipt.agent.id)
    } catch (error) {
      console.error('Agent launch failed', error)
      setFailure({
        message: error instanceof Error ? error.message : 'The Agent could not be started.',
        agentId: error instanceof AgentClientError ? (error.recovery?.agentId ?? null) : null,
      })
    } finally {
      setLaunching(null)
    }
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={next => {
        setOpen(next)
        if (!next) setFailure(null)
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          className="grid size-7 flex-none place-items-center rounded-sm border-0 bg-transparent text-muted hover:bg-hover hover:text-foreground [&_svg]:size-3.5"
          aria-label="Add Agent"
          title="Add Agent"
        >
          <Plus aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-[var(--z-dropdown)] w-72 rounded-md border border-border bg-surface p-1.5 text-foreground shadow-[var(--shadow-popover)] outline-none"
          align="end"
          sideOffset={4}
          aria-label="Add Agent"
        >
          <p className="m-0 px-2 pt-1 pb-1.5 text-2xs font-semibold uppercase tracking-[0.08em] text-faint">
            Running Agents
          </p>
          {available.length === 0 ? (
            <p className="m-0 px-2 pb-2 text-xs text-muted">All running Agents are open.</p>
          ) : (
            available.map(agent => (
              <button
                type="button"
                key={agent.id}
                className={optionClass}
                onClick={() => attach(agent.id)}
                title={agent.cwd ?? undefined}
              >
                <StatusDot status={agent.status} className="mt-[0.3rem]" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{agent.name}</span>
                  <span className="block truncate text-muted">
                    {[agentProviderLabel(agent.provider), agentDirectoryLabel(agent.cwd)]
                      .filter(value => value !== null)
                      .join(' · ')}
                  </span>
                </span>
              </button>
            ))
          )}
          {projectName && (
            <div className="mt-1 border-border border-t pt-1">
              {providers.map(provider => (
                <button
                  type="button"
                  key={provider}
                  className={optionClass}
                  disabled={!runtimeAvailable || launching !== null}
                  onClick={() => void launch(provider)}
                >
                  <Plus aria-hidden="true" className="mt-0.5 size-3 flex-none text-faint" />
                  <span>
                    {launching === provider
                      ? `Starting ${agentProviderLabel(provider)}…`
                      : `New ${agentProviderLabel(provider)} in ${projectName}`}
                  </span>
                </button>
              ))}
            </div>
          )}
          {failure && (
            <div className="m-1 rounded-sm bg-danger/8 p-2 text-xs text-danger" role="alert">
              {failure.message}
              {failure.agentId && (
                <button
                  type="button"
                  className="ml-1 border-0 bg-transparent p-0 text-xs text-foreground underline"
                  onClick={() => attach(failure.agentId ?? '')}
                >
                  Open Agent
                </button>
              )}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
