import type { Project } from '@herdr-roam/shared'
import { PanelLeft, PanelRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Group, Panel, Separator, useDefaultLayout, usePanelRef } from 'react-resizable-panels'
import { useAgentRuntime } from '../../features/agent/runtime-provider'
import { AssistantPanel } from '../../features/assistant'
import { useAssistantStore } from '../../features/assistant/store'
import { cn } from '../../lib/cn'
import type { GlobalDimension, ProjectSection, ResourceRef } from '../../workbench/resource'
import { ActivityBar } from '../activity-bar'
import { BrandMark } from '../brand-mark'
import { ContextSidebar } from '../context-sidebar'
import { ProjectSelect } from '../context-sidebar/project-select'
import { ResourceHost } from '../resource-host'
import { RuntimeStatus } from '../runtime-status'
import { TabBar } from '../tab-bar'

const DEFAULT_SIDEBAR_WIDTH = 320
const SIDEBAR_WIDTH_KEY = 'herdr-roam.sidebar-width.v1'

const DEFAULT_ASSISTANT_WIDTH = 520
const MIN_ASSISTANT_WIDTH = 380
const ASSISTANT_WIDTH_KEY = 'herdr-roam.assistant-width.v1'

const readWidth = (key: string, minimum: number, fallback: number): number => {
  try {
    const value = Number(globalThis.localStorage?.getItem(key))
    return Number.isFinite(value) && value >= minimum ? value : fallback
  } catch (error) {
    console.error(`${key} read failed`, error)
    return fallback
  }
}

const writeWidth = (key: string, width: number): void => {
  try {
    globalThis.localStorage?.setItem(key, String(width))
  } catch (error) {
    console.error(`${key} write failed`, error)
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
  readonly projectRouteKey: string
  readonly tabs: readonly ResourceRef[]
  readonly active: ResourceRef | null
  readonly onProject: (projectName: string) => void
  readonly onAddProject: (path: string) => Promise<Project>
  readonly onRemoveProject: (projectName: string) => Promise<void>
  readonly onWorkbench: () => void
  readonly onOpen: (resource: ResourceRef) => void
  readonly onClose: (resource: ResourceRef) => void
  readonly onCloseMany: (resources: readonly ResourceRef[]) => void
}

export const AppShell = ({
  projects,
  activeProjectName,
  projectConfigPath,
  projectError,
  activeDimension,
  activityPaths,
  projectSection,
  projectRouteKey,
  tabs,
  active,
  onProject,
  onAddProject,
  onRemoveProject,
  onWorkbench,
  onOpen,
  onClose,
  onCloseMany,
}: Props) => {
  const { snapshot, transportError } = useAgentRuntime()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const sidebarRef = usePanelRef()
  const expandedWidth = useRef(readWidth(SIDEBAR_WIDTH_KEY, 280, DEFAULT_SIDEBAR_WIDTH))
  const assistantOpen = useAssistantStore(state => state.open)
  const maximized = useAssistantStore(state => state.maximized)
  const setAssistantOpen = useAssistantStore(state => state.setOpen)
  const setMaximized = useAssistantStore(state => state.setMaximized)
  const assistantRef = usePanelRef()
  const workbenchRef = usePanelRef()
  const assistantWidth = useRef(
    readWidth(ASSISTANT_WIDTH_KEY, MIN_ASSISTANT_WIDTH, DEFAULT_ASSISTANT_WIDTH),
  )
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'herdr-roam.app-shell.v2',
    panelIds: ['context-sidebar', 'workbench', 'assistant'],
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
    writeWidth(SIDEBAR_WIDTH_KEY, width)
  }

  useEffect(() => {
    const panel = assistantRef.current
    if (!panel) return
    if (assistantOpen && panel.isCollapsed()) panel.resize(assistantWidth.current)
    if (!assistantOpen && !panel.isCollapsed()) panel.collapse()
  }, [assistantOpen, assistantRef])

  useEffect(() => {
    const panel = workbenchRef.current
    if (!panel) return
    if (maximized && !panel.isCollapsed()) panel.collapse()
    if (!maximized && panel.isCollapsed()) panel.expand()
  }, [maximized, workbenchRef])

  const resizeAssistant = (width: number) => {
    const collapsed = width < MIN_ASSISTANT_WIDTH
    setAssistantOpen(!collapsed)
    if (collapsed || maximized) return
    assistantWidth.current = width
    writeWidth(ASSISTANT_WIDTH_KEY, width)
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
                error={projectError}
                configPath={projectConfigPath}
                onValueChange={onProject}
                onAdd={onAddProject}
                onRemove={onRemoveProject}
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
              onChange={selectDimension}
            />
            <div
              className={cn('flex min-h-0 min-w-0 flex-1 flex-col', sidebarCollapsed && 'hidden')}
              aria-hidden={sidebarCollapsed || undefined}
              data-testid="sidebar-context"
            >
              <ContextSidebar
                dimension={activeDimension}
                activeProjectName={activeProjectName}
                activeFile={active?.type === 'file' ? active : null}
                activeSkill={active?.type === 'skill' ? active : null}
                projectSection={projectSection}
                projectRouteKey={projectRouteKey}
                onOpen={onOpen}
              />
              <footer className="flex h-10.5 flex-none border-border border-t px-2">
                <RuntimeStatus
                  snapshot={snapshot}
                  transportError={transportError?.message ?? null}
                />
              </footer>
            </div>
          </div>
        </Panel>
        <Separator className="w-px bg-border transition-colors duration-150 hover:bg-primary data-[resize-handle-active]:bg-primary" />
        <Panel
          id="workbench"
          minSize={560}
          collapsible
          collapsedSize={0}
          panelRef={workbenchRef}
          onResize={size => setMaximized(size.inPixels === 0)}
          className="flex min-h-0 min-w-0 flex-col bg-surface"
        >
          <TabBar
            tabs={tabs}
            active={active}
            onWorkbench={onWorkbench}
            onActivate={onOpen}
            onClose={onClose}
            onCloseMany={onCloseMany}
            trailing={
              <button
                type="button"
                className={cn(
                  'grid w-10 flex-none place-items-center border-0 border-border border-l bg-transparent text-muted hover:bg-hover hover:text-foreground [&_svg]:size-3.5',
                  assistantOpen && 'text-foreground',
                )}
                onClick={() => setAssistantOpen(!assistantOpen)}
                aria-pressed={assistantOpen}
                aria-label={assistantOpen ? 'Close Assistant' : 'Open Assistant'}
                title={assistantOpen ? 'Close Assistant' : 'Open Assistant'}
              >
                <PanelRight aria-hidden="true" />
              </button>
            }
          />
          <ResourceHost
            project={projects.find(project => project.name === activeProjectName) ?? null}
            tabs={tabs}
            active={active}
            onOpen={onOpen}
          />
        </Panel>
        <Separator className="w-px bg-border transition-colors duration-150 hover:bg-primary data-[resize-handle-active]:bg-primary" />
        <Panel
          id="assistant"
          defaultSize={0}
          minSize={MIN_ASSISTANT_WIDTH}
          groupResizeBehavior="preserve-pixel-size"
          collapsible
          collapsedSize={0}
          panelRef={assistantRef}
          onResize={size => resizeAssistant(size.inPixels)}
          className="flex min-h-0 min-w-0 flex-col"
        >
          {assistantOpen && (
            <AssistantPanel projectName={activeProjectName} projects={projects} onOpen={onOpen} />
          )}
        </Panel>
      </Group>
    </div>
  )
}
