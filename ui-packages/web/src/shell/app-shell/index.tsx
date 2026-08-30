import type { Project, ProjectCreateRequest } from '@herdr-roam/shared'
import { PanelLeft } from 'lucide-react'
import { useRef, useState } from 'react'
import { Group, Panel, Separator, useDefaultLayout, usePanelRef } from 'react-resizable-panels'
import { useAgentRuntime } from '../../features/agent/runtime-provider'
import { cn } from '../../lib/cn'
import type {
  GlobalDimension,
  ProjectSection,
  ResourceRef,
  UtilityRef,
} from '../../workbench/resource'
import { ActivityBar } from '../activity-bar'
import { BrandMark } from '../brand-mark'
import { ContextSidebar } from '../context-sidebar'
import { ProjectSelect } from '../context-sidebar/project-select'
import { ResourceHost } from '../resource-host'
import { TabBar } from '../tab-bar'

const DEFAULT_SIDEBAR_WIDTH = 320
const SIDEBAR_WIDTH_KEY = 'herdr-roam.sidebar-width.v1'

const readSidebarWidth = (): number => {
  try {
    const value = Number(globalThis.localStorage?.getItem(SIDEBAR_WIDTH_KEY))
    return Number.isFinite(value) && value >= 280 ? value : DEFAULT_SIDEBAR_WIDTH
  } catch (error) {
    console.error('sidebar width read failed', error)
    return DEFAULT_SIDEBAR_WIDTH
  }
}

const writeSidebarWidth = (width: number): void => {
  try {
    globalThis.localStorage?.setItem(SIDEBAR_WIDTH_KEY, String(width))
  } catch (error) {
    console.error('sidebar width write failed', error)
  }
}

type Props = {
  readonly projects: readonly Project[]
  readonly activeProjectName: string
  readonly projectConfigPath: string | null
  readonly projectError: string | null
  readonly activeDimension: GlobalDimension
  readonly activityPaths: Readonly<Record<GlobalDimension, string>>
  readonly projectSection: ProjectSection
  readonly tabs: readonly ResourceRef[]
  readonly active: ResourceRef | null
  readonly activeUtility: UtilityRef | null
  readonly onProject: (projectName: string) => void
  readonly onAddProject: (request: ProjectCreateRequest) => Promise<void>
  readonly onProjectSection: (section: ProjectSection) => void
  readonly onWorkbench: () => void
  readonly onOpen: (resource: ResourceRef) => void
  readonly onClose: (resource: ResourceRef) => void
  readonly onRuntime: () => void
  readonly onCloseUtility: () => void
}

export const AppShell = ({
  projects,
  activeProjectName,
  projectConfigPath,
  projectError,
  activeDimension,
  activityPaths,
  projectSection,
  tabs,
  active,
  activeUtility,
  onProject,
  onAddProject,
  onProjectSection,
  onWorkbench,
  onOpen,
  onClose,
  onRuntime,
  onCloseUtility,
}: Props) => {
  const { snapshot } = useAgentRuntime()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const sidebarRef = usePanelRef()
  const expandedWidth = useRef(readSidebarWidth())
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'herdr-roam.app-shell.v1',
    panelIds: ['context-sidebar', 'workbench'],
    storage: globalThis.localStorage,
  })

  const setCollapsed = (collapsed: boolean) => {
    setSidebarCollapsed(collapsed)
    if (collapsed) sidebarRef.current?.collapse()
    else sidebarRef.current?.resize(expandedWidth.current)
  }

  const resizeSidebar = (width: number) => {
    const collapsed = width <= 44
    setSidebarCollapsed(collapsed)
    if (collapsed || width < 280) return
    expandedWidth.current = width
    writeSidebarWidth(width)
  }

  const selectDimension = () => {
    if (sidebarCollapsed) setCollapsed(false)
  }

  return (
    <div className="h-dvh w-screen min-w-[64rem] overflow-hidden bg-background text-foreground">
      <Group
        orientation="horizontal"
        className="min-h-0 min-w-0"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        <Panel
          id="context-sidebar"
          defaultSize={DEFAULT_SIDEBAR_WIDTH}
          minSize={280}
          maxSize="50%"
          groupResizeBehavior="preserve-pixel-size"
          collapsible
          collapsedSize={44}
          panelRef={sidebarRef}
          onResize={size => resizeSidebar(size.inPixels)}
          className="flex min-h-0 min-w-0 flex-col bg-sidebar"
          data-collapsed={sidebarCollapsed || undefined}
        >
          <header className="grid h-10 flex-none grid-cols-[2.75rem_minmax(0,1fr)] border-border border-b">
            <div
              className={cn(
                'grid place-items-center border-border border-r',
                sidebarCollapsed && 'border-r-0',
              )}
            >
              {sidebarCollapsed ? (
                <button
                  type="button"
                  className="group relative grid h-full w-full place-items-center border-0 bg-transparent text-muted outline-none hover:bg-hover hover:text-foreground focus-visible:bg-hover focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => setCollapsed(false)}
                  title="Expand sidebar"
                  aria-label="Expand sidebar"
                >
                  <span
                    className="transition-opacity duration-100 group-hover:opacity-0 group-focus-visible:opacity-0"
                    aria-hidden="true"
                  >
                    <BrandMark />
                  </span>
                  <PanelLeft
                    className="absolute size-4 opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100"
                    aria-hidden="true"
                  />
                </button>
              ) : (
                <BrandMark />
              )}
            </div>
            <div
              className={cn(
                'flex min-w-0 items-center gap-1 pr-1 pl-2',
                sidebarCollapsed && 'hidden',
              )}
              aria-hidden={sidebarCollapsed || undefined}
            >
              <ProjectSelect
                projects={projects}
                value={activeProjectName}
                onValueChange={onProject}
              />
              <button
                type="button"
                className="grid size-7 flex-none place-items-center rounded-sm border-0 bg-transparent text-muted hover:bg-hover hover:text-foreground [&_svg]:size-3.5"
                onClick={() => setCollapsed(true)}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <PanelLeft aria-hidden="true" />
              </button>
            </div>
          </header>
          <div className="flex min-h-0 min-w-0 flex-1">
            <ActivityBar
              active={activeDimension}
              paths={activityPaths}
              runtimeActive={activeUtility === 'runtime'}
              onChange={selectDimension}
              onRuntime={onRuntime}
            />
            <div
              className={cn('flex min-h-0 min-w-0 flex-1 flex-col', sidebarCollapsed && 'hidden')}
              aria-hidden={sidebarCollapsed || undefined}
              data-testid="sidebar-context"
            >
              <ContextSidebar
                dimension={activeDimension}
                activeProjectName={activeProjectName}
                activeAgentId={active?.type === 'agent' ? active.agentId : null}
                projectSection={projectSection}
                onProjectSection={onProjectSection}
                onOpen={onOpen}
              />
              <footer className="flex h-10.5 flex-none items-center gap-2 border-border border-t px-2.75 text-[0.6875rem] text-muted">
                {snapshot.items.length > 0 || snapshot.source.state === 'connected' ? (
                  <>
                    <span>{snapshot.items.length} agents</span>
                    <span className="text-warning">
                      {snapshot.items.filter(agent => agent.status === 'blocked').length} blocked
                    </span>
                    {snapshot.stale && <span className="text-faint">stale</span>}
                  </>
                ) : (
                  <span className="text-danger">Runtime unavailable</span>
                )}
              </footer>
            </div>
          </div>
        </Panel>
        <Separator className="w-px bg-border transition-colors duration-150 hover:bg-primary data-[resize-handle-active]:bg-primary" />
        <Panel id="workbench" minSize={560} className="flex min-h-0 min-w-0 flex-col bg-surface">
          <TabBar
            tabs={tabs}
            active={active}
            activeUtility={activeUtility}
            onWorkbench={onWorkbench}
            onRuntime={onRuntime}
            onCloseUtility={onCloseUtility}
            onActivate={onOpen}
            onClose={onClose}
          />
          <ResourceHost
            project={projects.find(project => project.name === activeProjectName) ?? null}
            projects={projects}
            projectConfigPath={projectConfigPath}
            projectError={projectError}
            tabs={tabs}
            active={active}
            activeUtility={activeUtility}
            onOpen={onOpen}
            onAddProject={onAddProject}
          />
        </Panel>
      </Group>
    </div>
  )
}
