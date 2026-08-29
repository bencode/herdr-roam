import { useCallback, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { projectByName } from './mock/data'
import { AppShell } from './shell/app-shell'
import { type ResourceRef, sameResource } from './workbench/resource'
import {
  parseResourcePath,
  projectPath,
  resourcePath,
  runtimePath,
} from './workbench/resource-route'
import { useWorkbenchStore } from './workbench/store'

export const App = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const tabs = useWorkbenchStore(state => state.tabs)
  const activeProjectName = useWorkbenchStore(state => state.activeProjectName)
  const lastActive = useWorkbenchStore(state => state.lastActive)
  const open = useWorkbenchStore(state => state.open)
  const close = useWorkbenchStore(state => state.close)
  const showWorkbench = useWorkbenchStore(state => state.showWorkbench)
  const setActiveProject = useWorkbenchStore(state => state.setActiveProject)
  const target = useMemo(() => parseResourcePath(location.pathname), [location.pathname])
  const active = target.kind === 'resource' ? target.resource : null
  const activeUtility = target.kind === 'utility' ? target.utility : null

  useEffect(() => {
    if (target.kind === 'root') {
      navigate(lastActive ? resourcePath(lastActive) : projectPath(activeProjectName), {
        replace: true,
      })
      return
    }
    if (target.kind === 'projects') {
      navigate(projectPath(activeProjectName), { replace: true })
      return
    }
    if (target.kind === 'unknown') {
      console.error('unknown workbench route', location.pathname)
      navigate(projectPath(activeProjectName), { replace: true })
      return
    }
    if (target.kind === 'workbench') {
      if (!projectByName(target.projectName)) {
        console.error('unknown project route', target.projectName)
        navigate(projectPath(activeProjectName), { replace: true })
        return
      }
      if (target.projectName !== activeProjectName) setActiveProject(target.projectName)
      showWorkbench()
      return
    }
    if (target.kind === 'utility') return
    const owner = 'projectName' in target.resource ? target.resource.projectName : null
    if (owner && !projectByName(owner)) {
      console.error('unknown resource project', owner)
      navigate(projectPath(activeProjectName), { replace: true })
      return
    }
    open(target.resource)
  }, [
    activeProjectName,
    lastActive,
    location.pathname,
    navigate,
    open,
    setActiveProject,
    showWorkbench,
    target,
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
    () => navigate(lastActive ? resourcePath(lastActive) : projectPath(activeProjectName)),
    [activeProjectName, lastActive, navigate],
  )

  return (
    <AppShell
      activeProjectName={activeProjectName}
      tabs={tabs}
      active={active}
      activeUtility={activeUtility}
      onProject={selectProject}
      onWorkbench={openWorkbench}
      onOpen={openResource}
      onClose={closeResource}
      onRuntime={openRuntime}
      onCloseUtility={closeUtility}
    />
  )
}
