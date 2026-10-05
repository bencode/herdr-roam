import type { AgentSummary } from '@herdr-roam/shared'
import type { ReactNode } from 'react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  openContextMenuFromKeyboard,
} from '../../ui/context-menu'
import { agentAttachCommand } from '../agent/presentation'

type Props = {
  readonly children: ReactNode
  readonly agentId: string
  readonly agentIds: readonly string[]
  readonly agent: AgentSummary | null
  readonly onCloseMany: (agentIds: readonly string[]) => void
}

const copyAttachCommand = async (agent: AgentSummary) => {
  try {
    await navigator.clipboard.writeText(agentAttachCommand(agent))
  } catch (error) {
    console.error('Attach command copy failed', error)
  }
}

/** Closing only removes tabs from the panel; the Agents keep running in Herdr. */
export const AgentTabMenu = ({ children, agentId, agentIds, agent, onCloseMany }: Props) => {
  const index = agentIds.indexOf(agentId)
  const otherIds = agentIds.filter(id => id !== agentId)
  const rightIds = index < 0 ? [] : agentIds.slice(index + 1)

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild onKeyDown={openContextMenuFromKeyboard}>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent aria-label="Agent tab actions">
        <ContextMenuItem onSelect={() => onCloseMany([agentId])}>Close</ContextMenuItem>
        <ContextMenuItem disabled={otherIds.length === 0} onSelect={() => onCloseMany(otherIds)}>
          Close Other Tabs
        </ContextMenuItem>
        <ContextMenuItem disabled={rightIds.length === 0} onSelect={() => onCloseMany(rightIds)}>
          Close Tabs to the Right
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onCloseMany(agentIds)}>Close All Tabs</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          disabled={!agent}
          onSelect={() => {
            if (agent) void copyAttachCommand(agent)
          }}
        >
          Copy Attach Command
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
