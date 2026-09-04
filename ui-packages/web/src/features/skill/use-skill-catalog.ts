import type { SkillCatalog } from '@herdr-roam/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSkillCatalog, SkillClientError } from './client'

type State = {
  readonly projectName: string
  readonly value: SkillCatalog | null
  readonly loading: boolean
  readonly error: SkillClientError | null
}

const clientError = (error: unknown): SkillClientError =>
  error instanceof SkillClientError
    ? error
    : new SkillClientError('network_error', 'Skills could not be loaded.', { cause: error })

export const useSkillCatalog = (projectName: string) => {
  const [state, setState] = useState<State>({ projectName, value: null, loading: true, error: null })
  const sequence = useRef(0)

  const load = useCallback(
    (signal?: AbortSignal) => {
      const request = ++sequence.current
      setState(current => ({
        projectName,
        value: current.projectName === projectName ? current.value : null,
        loading: true,
        error: null,
      }))
      void fetchSkillCatalog(projectName, signal).then(
        value => {
          if (!signal?.aborted && request === sequence.current) {
            setState({ projectName, value, loading: false, error: null })
          }
        },
        error => {
          if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError'))
            return
          if (request === sequence.current) {
            setState({ projectName, value: null, loading: false, error: clientError(error) })
          }
        },
      )
    },
    [projectName],
  )

  useEffect(() => {
    const controller = new AbortController()
    setState({ projectName, value: null, loading: true, error: null })
    load(controller.signal)
    return () => controller.abort()
  }, [load, projectName])

  const visible =
    state.projectName === projectName
      ? state
      : { projectName, value: null, loading: true, error: null }
  return { ...visible, reload: () => load() }
}
