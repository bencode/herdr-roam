import type { AgentStatus } from '@herdr-roam/shared'
import { Bot, Box, CircleDot, FileText, Home, MessageSquare, X } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { useAgentRuntime } from '../../features/agent/runtime-provider'
import { useSessionData } from '../../features/session/use-session-data'
import { cn } from '../../lib/cn'
import {
  type ResourceRef,
  resourceKey,
  resourceTitle,
  sameResource,
} from '../../workbench/resource'
import { TabContextMenu } from './tab-context-menu'

const WORKBENCH_KEY = 'workbench'

const statusClasses: Readonly<Record<AgentStatus, string>> = {
  working: 'bg-primary',
  blocked: 'bg-warning',
  idle: 'bg-muted',
  done: 'bg-success',
  unknown: 'bg-faint',
}

const SessionTitle = ({
  resource,
}: {
  readonly resource: Extract<ResourceRef, { type: 'session' }>
}) => {
  const session = useSessionData(resource.projectName, resource.provider, resource.sessionId, false)
  return <span>{session.value?.title ?? resource.sessionId}</span>
}

const tabShellClass =
  'group flex min-w-32 max-w-55 flex-[0_1_11.875rem] items-stretch border-border border-r text-muted max-[68rem]:basis-37.5'
const selectedTabClass =
  "relative z-1 bg-surface text-foreground shadow-[inset_0_2px_var(--foreground)] after:pointer-events-none after:absolute after:right-0 after:bottom-[-1px] after:left-0 after:h-px after:bg-surface after:content-['']"
const tabClass =
  'flex min-w-0 flex-1 items-center gap-1.75 border-0 bg-transparent pr-1.5 pl-2.75 text-left text-inherit hover:bg-hover hover:text-foreground group-[.bg-surface]:hover:bg-transparent [&>span]:truncate [&>span]:min-w-0 [&>svg]:w-3.25 [&>svg]:flex-none [&>svg]:text-faint group-[.bg-surface]:[&>svg]:text-foreground'
const closeClass =
  'grid size-6 flex-none place-items-center self-center rounded-sm border-0 bg-transparent text-muted opacity-0 hover:bg-hover hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 group-[.bg-surface]:opacity-100 [&>svg]:w-3'

const ResourceIcon = ({ resource }: { readonly resource: ResourceRef }) => {
  if (resource.type === 'agent') return <Bot />
  if (resource.type === 'session') return <MessageSquare />
  if (resource.type === 'issue') return <CircleDot />
  if (resource.type === 'file') return <FileText />
  return <Box />
}

type Props = {
  readonly tabs: readonly ResourceRef[]
  readonly active: ResourceRef | null
  readonly onWorkbench: () => void
  readonly onActivate: (resource: ResourceRef) => void
  readonly onClose: (resource: ResourceRef) => void
  readonly onCloseMany: (resources: readonly ResourceRef[]) => void
}

export const TabBar = ({ tabs, active, onWorkbench, onActivate, onClose, onCloseMany }: Props) => {
  const { agentById, snapshot } = useAgentRuntime()
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const visibleRefs = useRef(new Map<string, HTMLElement>())
  const keys = [WORKBENCH_KEY, ...tabs.map(resourceKey)]
  const activeKey = active ? resourceKey(active) : WORKBENCH_KEY

  useLayoutEffect(() => {
    visibleRefs.current.get(activeKey)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [activeKey])

  const focusAt = (index: number) => {
    const key = keys[(index + keys.length) % keys.length]
    if (!key) return
    refs.current.get(key)?.focus()
    if (key === WORKBENCH_KEY) onWorkbench()
    else {
      const resource = tabs.find(tab => resourceKey(tab) === key)
      if (resource) onActivate(resource)
    }
  }

  const keyboard = (event: React.KeyboardEvent, key: string) => {
    const index = keys.indexOf(key)
    const targets: Record<string, number> = {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      Home: 0,
      End: keys.length - 1,
    }
    const target = targets[event.key]
    if (target === undefined) return
    event.preventDefault()
    focusAt(target)
  }

  return (
    <div className="relative flex h-10 min-w-0 flex-none border-border border-b bg-sidebar">
      <div
        className="flex min-w-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden"
        role="tablist"
        aria-label="Open workbench resources"
      >
        <div
          className={cn(
            tabShellClass,
            'min-w-29.5 max-w-29.5 flex-none',
            active === null && selectedTabClass,
          )}
          ref={node => {
            if (node) visibleRefs.current.set(WORKBENCH_KEY, node)
            else visibleRefs.current.delete(WORKBENCH_KEY)
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={active === null}
            tabIndex={active === null ? 0 : -1}
            className={tabClass}
            ref={node => {
              if (node) refs.current.set(WORKBENCH_KEY, node)
              else refs.current.delete(WORKBENCH_KEY)
            }}
            onClick={onWorkbench}
            onKeyDown={event => keyboard(event, WORKBENCH_KEY)}
          >
            <Home />
            <span>Workbench</span>
          </button>
        </div>
        {tabs.map(resource => {
          const key = resourceKey(resource)
          const selected = active ? sameResource(active, resource) : false
          const owner =
            resource.type === 'agent'
              ? 'Herdr'
              : resource.type === 'skill'
                ? resource.scope === 'project'
                  ? resource.projectName
                  : 'user'
                : resource.projectName
          const agent = resource.type === 'agent' ? agentById(resource.agentId) : undefined
          const sessionAgent =
            resource.type === 'session'
              ? snapshot.items.find(
                  candidate =>
                    candidate.session?.kind === 'id' &&
                    candidate.session.agent === resource.provider &&
                    candidate.session.value === resource.sessionId,
                )
              : undefined
          const title = agent?.name ?? resourceTitle(resource)
          const status = agent?.status ?? sessionAgent?.status
          return (
            <TabContextMenu key={key} resource={resource} tabs={tabs} onCloseMany={onCloseMany}>
              <div
                className={cn(tabShellClass, selected && selectedTabClass)}
                ref={node => {
                  if (node) visibleRefs.current.set(key, node)
                  else visibleRefs.current.delete(key)
                }}
                onAuxClick={event => event.button === 1 && onClose(resource)}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  className={tabClass}
                  ref={node => {
                    if (node) refs.current.set(key, node)
                    else refs.current.delete(key)
                  }}
                  onClick={() => onActivate(resource)}
                  onKeyDown={event => keyboard(event, key)}
                  title={`${title} · ${owner}`}
                >
                  {status && (
                    <i
                      className={cn('size-1.5 flex-none rounded-full', statusClasses[status])}
                      role="img"
                      aria-label={status}
                    />
                  )}
                  {!status && <ResourceIcon resource={resource} />}
                  {resource.type === 'session' ? (
                    <SessionTitle resource={resource} />
                  ) : (
                    <span>{title}</span>
                  )}
                </button>
                <button
                  type="button"
                  className={closeClass}
                  onClick={() => onClose(resource)}
                  aria-label={`Close ${title}`}
                >
                  <X />
                </button>
              </div>
            </TabContextMenu>
          )
        })}
      </div>
    </div>
  )
}
