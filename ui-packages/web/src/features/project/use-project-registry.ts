import type { ProjectCreateRequest, ProjectRegistrySnapshot } from '@herdr-roam/shared'
import { useCallback, useEffect, useState } from 'react'
import { createProject, fetchProjects, ProjectClientError } from './client'

type RegistryState =
  | { readonly status: 'loading'; readonly snapshot: null; readonly error: null }
  | { readonly status: 'ready'; readonly snapshot: ProjectRegistrySnapshot; readonly error: null }
  | { readonly status: 'error'; readonly snapshot: null; readonly error: ProjectClientError }

export type ProjectRegistryValue = RegistryState & {
  readonly addProject: (request: ProjectCreateRequest) => Promise<void>
}

export const useProjectRegistry = (): ProjectRegistryValue => {
  const [state, setState] = useState<RegistryState>({
    status: 'loading',
    snapshot: null,
    error: null,
  })

  useEffect(() => {
    let active = true
    void fetchProjects()
      .then(snapshot => {
        if (active) setState({ status: 'ready', snapshot, error: null })
      })
      .catch(error => {
        if (!active) return
        console.error('Project registry request failed', error)
        setState({
          status: 'error',
          snapshot: null,
          error:
            error instanceof ProjectClientError
              ? error
              : new ProjectClientError('network_error', 'Projects could not be loaded.', null, {
                  cause: error,
                }),
        })
      })
    return () => {
      active = false
    }
  }, [])

  const addProject = useCallback(async (request: ProjectCreateRequest) => {
    const receipt = await createProject(request)
    setState({
      status: 'ready',
      snapshot: { configPath: receipt.configPath, projects: receipt.projects },
      error: null,
    })
  }, [])

  return { ...state, addProject }
}
