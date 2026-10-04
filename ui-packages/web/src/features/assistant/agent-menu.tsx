import type { AgentProvider } from '@herdr-roam/shared'
import * as Popover from '@radix-ui/react-popover'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Banner } from '../../ui/banner'
import { Button } from '../../ui/button'
import { MenuItem, menuItemVariants } from '../../ui/menu'
import { PopoverContent } from '../../ui/popover'
import { SectionHeader } from '../../ui/section-header'
import { AgentClientError, launchProjectAgent } from '../agent/client'
import { agentDirectoryLabel, agentProviderLabel } from '../agent/presentation'
import { useAgentRuntime } from '../agent/runtime-provider'
import { StatusDot } from '../agent/status-dot'
import { useAssistantStore } from './store'

const providers: readonly AgentProvider[] = ['claude', 'codex']

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
        <Button size="compactIcon" aria-label="Add Agent" title="Add Agent">
          <Plus aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <PopoverContent className="w-72 p-1" align="end" aria-label="Add Agent">
        <SectionHeader title="Running Agents" />
        {available.length === 0 ? (
          <p className="m-0 px-2 pb-2 text-xs text-muted">All running Agents are open.</p>
        ) : (
          available.map(agent => (
            <button
              type="button"
              key={agent.id}
              className={menuItemVariants({ className: 'h-auto items-start py-1.5' })}
              onClick={() => attach(agent.id)}
              title={agent.cwd ?? undefined}
            >
              <StatusDot status={agent.status} className="mt-1.25" />
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
              <MenuItem
                key={provider}
                disabled={!runtimeAvailable || launching !== null}
                onClick={() => void launch(provider)}
              >
                <Plus aria-hidden="true" className="text-faint" />
                <span className="min-w-0 truncate">
                  {launching === provider
                    ? `Starting ${agentProviderLabel(provider)}…`
                    : `New ${agentProviderLabel(provider)} in ${projectName}`}
                </span>
              </MenuItem>
            ))}
          </div>
        )}
        {failure && (
          <Banner
            tone="danger"
            inset
            className="m-1"
            action={
              failure.agentId && (
                <Button size="compact" onClick={() => attach(failure.agentId ?? '')}>
                  Open Agent
                </Button>
              )
            }
          >
            {failure.message}
          </Banner>
        )}
      </PopoverContent>
    </Popover.Root>
  )
}
