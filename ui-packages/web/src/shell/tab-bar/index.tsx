import { Box, CircleDot, FileText, Home, MessageSquare, Server, X } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { cn } from '../../lib/cn'
import type { AgentStatus } from '../../mock/data'
import { resourceTitle, sessionById } from '../../mock/data'
import {
  type ResourceRef,
  resourceKey,
  sameResource,
  type UtilityRef,
} from '../../workbench/resource'

const WORKBENCH_KEY = 'workbench'
const RUNTIME_KEY = 'utility:runtime'

const statusClasses: Readonly<Record<AgentStatus, string>> = {
  working: 'bg-primary',
  blocked: 'bg-warning',
  idle: 'bg-primary',
  done: 'bg-success',
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
  if (resource.type === 'session') return <MessageSquare />
  if (resource.type === 'issue') return <CircleDot />
  if (resource.type === 'file') return <FileText />
  return <Box />
}

type Props = {
  readonly tabs: readonly ResourceRef[]
  readonly active: ResourceRef | null
  readonly activeUtility: UtilityRef | null
  readonly onWorkbench: () => void
  readonly onRuntime: () => void
  readonly onCloseUtility: () => void
  readonly onActivate: (resource: ResourceRef) => void
  readonly onClose: (resource: ResourceRef) => void
}

export const TabBar = ({
  tabs,
  active,
  activeUtility,
  onWorkbench,
  onRuntime,
  onCloseUtility,
  onActivate,
  onClose,
}: Props) => {
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const visibleRefs = useRef(new Map<string, HTMLElement>())
  const keys = [
    WORKBENCH_KEY,
    ...tabs.map(resourceKey),
    ...(activeUtility === 'runtime' ? [RUNTIME_KEY] : []),
  ]
  const activeKey =
    activeUtility === 'runtime' ? RUNTIME_KEY : active ? resourceKey(active) : WORKBENCH_KEY

  useLayoutEffect(() => {
    visibleRefs.current.get(activeKey)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [activeKey])

  const focusAt = (index: number) => {
    const key = keys[(index + keys.length) % keys.length]
    if (!key) return
    refs.current.get(key)?.focus()
    if (key === WORKBENCH_KEY) onWorkbench()
    else if (key === RUNTIME_KEY) onRuntime()
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
            active === null && activeUtility === null && selectedTabClass,
          )}
          ref={node => {
            if (node) visibleRefs.current.set(WORKBENCH_KEY, node)
            else visibleRefs.current.delete(WORKBENCH_KEY)
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={active === null && activeUtility === null}
            tabIndex={active === null && activeUtility === null ? 0 : -1}
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
            resource.type === 'skill'
              ? resource.scope === 'project'
                ? resource.projectName
                : 'user'
              : resource.projectName
          const session =
            resource.type === 'session'
              ? sessionById(resource.projectName, resource.sessionId)
              : undefined
          return (
            <div
              key={key}
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
                title={`${resourceTitle(resource)} · ${owner}`}
              >
                {session && (
                  <i
                    className={cn('size-1.5 flex-none rounded-full', statusClasses[session.status])}
                    role="img"
                    aria-label={session.status}
                  />
                )}
                {!session && <ResourceIcon resource={resource} />}
                <span>{resourceTitle(resource)}</span>
              </button>
              <button
                type="button"
                className={closeClass}
                onClick={() => onClose(resource)}
                aria-label={`Close ${resourceTitle(resource)}`}
              >
                <X />
              </button>
            </div>
          )
        })}
        {activeUtility === 'runtime' && (
          <div
            className={cn(tabShellClass, selectedTabClass)}
            ref={node => {
              if (node) visibleRefs.current.set(RUNTIME_KEY, node)
              else visibleRefs.current.delete(RUNTIME_KEY)
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected="true"
              tabIndex={0}
              className={tabClass}
              ref={node => {
                if (node) refs.current.set(RUNTIME_KEY, node)
                else refs.current.delete(RUNTIME_KEY)
              }}
              onClick={onRuntime}
              onKeyDown={event => keyboard(event, RUNTIME_KEY)}
            >
              <Server />
              <span>Runtime</span>
            </button>
            <button
              type="button"
              className={closeClass}
              onClick={onCloseUtility}
              aria-label="Close Runtime"
            >
              <X />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
