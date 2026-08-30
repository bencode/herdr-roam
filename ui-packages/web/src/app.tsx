import { useCallback, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AgentRuntimeProvider } from './features/agent/runtime-provider'
import { useProjectRegistry } from './features/project/use-project-registry'
import { AppShell } from './shell/app-shell'
import { type ProjectSection, type ResourceRef, sameResource } from './workbench/resource'
import {
  canonicalPath,
  parseResourcePath,
  projectPath,
  projectSectionPath,
  resourcePath,
  routeDimension,
  routeProjectSection,
  runtimePath,
} from './workbench/resource-route'
import { useWorkbenchStore } from './workbench/store'

const RoutedApp = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const projectRegistry = useProjectRegistry()
  const projects = projectRegistry.snapshot?.projects ?? []
  const tabs = useWorkbenchStore(state => state.tabs)
  const activeProjectName = useWorkbenchStore(state => state.activeProjectName)
  const lastActivity = useWorkbenchStore(state => state.lastActivity)
  const activityPaths = useWorkbenchStore(state => state.activityPaths)
  const open = useWorkbenchStore(state => state.open)
  const close = useWorkbenchStore(state => state.close)
  const rememberActivity = useWorkbenchStore(state => state.rememberActivity)
  const showWorkbench = useWorkbenchStore(state => state.showWorkbench)
  const setActiveProject = useWorkbenchStore(state => state.setActiveProject)
  const target = useMemo(() => parseResourcePath(location.pathname), [location.pathname])
  const active = target.kind === 'resource' ? target.resource : null
  const activeUtility = target.kind === 'utility' ? target.utility : null
  const routeActivity = routeDimension(target)
  const activeDimension = routeActivity ?? lastActivity
  const rememberedProjectTarget = useMemo(
    () => parseResourcePath(activityPaths.projects),
    [activityPaths.projects],
  )
  const projectSection =
    routeProjectSection(target) ?? routeProjectSection(rememberedProjectTarget) ?? 'sessions'
  const fallbackProjectName = projects.some(project => project.name === activeProjectName)
    ? activeProjectName
    : (projects[0]?.name ?? '')

  useEffect(() => {
    if (projectRegistry.status === 'loading') return
    if (fallbackProjectName && fallbackProjectName !== activeProjectName) {
      setActiveProject(fallbackProjectName)
    }
    if (
      (projectRegistry.status === 'error' || projects.length === 0) &&
      target.kind !== 'utility'
    ) {
      navigate(runtimePath(), { replace: true })
      return
    }
    if (target.kind === 'root') {
      navigate(activityPaths[lastActivity], { replace: true })
      return
    }
    if (target.kind === 'projects') {
      navigate(activityPaths.projects, { replace: true })
      return
    }
    if (target.kind === 'unknown') {
      console.error('unknown workbench route', location.pathname)
      navigate(projectPath(fallbackProjectName), { replace: true })
      return
    }
    const canonical = canonicalPath(target)
    if (canonical && canonical !== location.pathname) {
      navigate(canonical, { replace: true })
      return
    }
    if (target.kind === 'workbench' || target.kind === 'project-section') {
      if (!projects.some(project => project.name === target.projectName)) {
        console.error('unknown project route', target.projectName)
        navigate(projectPath(fallbackProjectName), { replace: true })
        return
      }
      if (target.projectName !== activeProjectName) setActiveProject(target.projectName)
      showWorkbench()
      rememberActivity('projects', canonical ?? projectPath(target.projectName))
      return
    }
    if (target.kind === 'utility') return
    if (target.kind === 'agent-list' || target.kind === 'skill-list') {
      showWorkbench()
      const dimension = routeDimension(target)
      if (dimension && canonical) rememberActivity(dimension, canonical)
      return
    }
    const owner = 'projectName' in target.resource ? target.resource.projectName : null
    if (owner && !projects.some(project => project.name === owner)) {
      console.error('unknown resource project', owner)
      navigate(projectPath(fallbackProjectName), { replace: true })
      return
    }
    open(target.resource)
    const dimension = routeDimension(target)
    if (dimension && canonical) rememberActivity(dimension, canonical)
  }, [
    activeProjectName,
    activityPaths,
    fallbackProjectName,
    lastActivity,
    location.pathname,
    navigate,
    open,
    rememberActivity,
    setActiveProject,
    showWorkbench,
    target,
    projectRegistry.status,
    projects,
  ])

  const openResource = useCallback(
    (resource: ResourceRef) => {
      open(resource)
      navigate(resourcePath(resource))
    },
    [navigate, open],
  )

  const openWorkbench = useCallback(() => {
    showWorkbench()
    navigate(projectPath(activeProjectName))
  }, [activeProjectName, navigate, showWorkbench])

  const selectProject = useCallback(
    (projectName: string) => {
      setActiveProject(projectName)
      showWorkbench()
      navigate(projectPath(projectName))
    },
    [navigate, setActiveProject, showWorkbench],
  )

  const selectProjectSection = useCallback(
    (section: ProjectSection) => navigate(projectSectionPath(activeProjectName, section)),
    [activeProjectName, navigate],
  )

  const closeResource = useCallback(
    (resource: ResourceRef) => {
      const wasActive = active ? sameResource(active, resource) : false
      const next = close(resource)
      if (!wasActive) return
      navigate(next ? resourcePath(next) : projectPath(activeProjectName))
    },
    [active, activeProjectName, close, navigate],
  )

  const openRuntime = useCallback(() => navigate(runtimePath()), [navigate])
  const closeUtility = useCallback(
    () => navigate(activityPaths[lastActivity]),
    [activityPaths, lastActivity, navigate],
  )

  return (
    <AppShell
      projects={projects}
      activeProjectName={activeProjectName}
      projectConfigPath={
        projectRegistry.snapshot?.configPath ?? projectRegistry.error?.configPath ?? null
      }
      projectError={projectRegistry.error?.message ?? null}
      activeDimension={activeDimension}
      activityPaths={activityPaths}
      projectSection={projectSection}
      tabs={tabs}
      active={active}
      activeUtility={activeUtility}
      onProject={selectProject}
      onAddProject={projectRegistry.addProject}
      onProjectSection={selectProjectSection}
      onWorkbench={openWorkbench}
      onOpen={openResource}
      onClose={closeResource}
      onRuntime={openRuntime}
      onCloseUtility={closeUtility}
    />
  )
}

export const App = () => (
  <AgentRuntimeProvider>
    <RoutedApp />
  </AgentRuntimeProvider>
)
