import type { Project, ProjectCreateRequest, ProjectRegistrySnapshot } from '@herdr-roam/shared'
import { useCallback, useEffect, useState } from 'react'
import {
  createProject,
  fetchProjects,
  ProjectClientError,
  removeProject,
  subscribeProjectSnapshots,
} from './client'

type RegistryState =
  | { readonly status: 'loading'; readonly snapshot: null; readonly error: null }
  | { readonly status: 'ready'; readonly snapshot: ProjectRegistrySnapshot; readonly error: null }
  | { readonly status: 'error'; readonly snapshot: null; readonly error: ProjectClientError }

export type ProjectRegistryValue = RegistryState & {
  readonly addProject: (request: ProjectCreateRequest) => Promise<Project>
  readonly removeProject: (projectName: string) => Promise<Project>
}

const clientError = (error: unknown): ProjectClientError =>
  error instanceof ProjectClientError
    ? error
    : new ProjectClientError('network_error', 'Projects could not be loaded.', null, {
        cause: error,
      })

export const useProjectRegistry = (): ProjectRegistryValue => {
  const [state, setState] = useState<RegistryState>({
    status: 'loading',
    snapshot: null,
    error: null,
  })

  useEffect(() => {
    let active = true
    let unsubscribe: (() => void) | null = null
    void fetchProjects()
      .then(snapshot => {
        if (!active) return
        setState({ status: 'ready', snapshot, error: null })
        unsubscribe = subscribeProjectSnapshots(
          next => {
            if (active) setState({ status: 'ready', snapshot: next, error: null })
          },
          error => console.error('Project event stream failed', error),
        )
      })
      .catch(error => {
        if (!active) return
        console.error('Project registry request failed', error)
        setState({ status: 'error', snapshot: null, error: clientError(error) })
      })
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [])

  const addProject = useCallback(async (request: ProjectCreateRequest) => {
    const receipt = await createProject(request)
    setState({
      status: 'ready',
      snapshot: { configPath: receipt.configPath, projects: receipt.projects },
      error: null,
    })
    return receipt.project
  }, [])

  const deleteProject = useCallback(async (projectName: string) => {
    const receipt = await removeProject(projectName)
    setState({
      status: 'ready',
      snapshot: { configPath: receipt.configPath, projects: receipt.projects },
      error: null,
    })
    return receipt.project
  }, [])

  return { ...state, addProject, removeProject: deleteProject }
}
