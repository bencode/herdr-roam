import type { AgentSessionRef, Project } from '@herdr-roam/shared'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ResourceRef } from '../../workbench/resource'
import { fetchProjectWorkspaces } from '../file/client'

type SessionResource = Extract<ResourceRef, { type: 'session' }>
type Resolution = {
  readonly resource: SessionResource | null
  readonly error: string | null
}

const normalizedPath = (path: string): string =>
  path.replaceAll('\\', '/').replace(/\/+$/, '') || '/'

export const useAgentSessionResource = (
  projects: readonly Project[],
  cwd: string | null,
  session: AgentSessionRef | null,
) => {
  const provider = session?.agent
  const kind = session?.kind
  const sessionId = session?.value
  const [resolution, setResolution] = useState<Resolution>({ resource: null, error: null })
  const pending = useRef<AbortController | null>(null)
  const [identity, setIdentity] = useState({ projects, cwd, provider, kind, sessionId })
  if (
    identity.projects !== projects ||
    identity.cwd !== cwd ||
    identity.provider !== provider ||
    identity.kind !== kind ||
    identity.sessionId !== sessionId
  ) {
    setIdentity({ projects, cwd, provider, kind, sessionId })
    setResolution({ resource: null, error: null })
  }
  const load = useCallback(
    async (signal: AbortSignal) => {
      if (
        !cwd ||
        !sessionId ||
        kind !== 'id' ||
        (provider !== 'codex' && provider !== 'claude') ||
        projects.length === 0
      )
        return
      setResolution({ resource: null, error: null })
      try {
        const directories = await Promise.allSettled(
          projects.map(async project => {
            const catalog = await fetchProjectWorkspaces(project.name, signal)
            return catalog.items.map(workspace => ({ projectName: project.name, ...workspace }))
          }),
        )
        if (signal.aborted) return
        directories.forEach((result, index) => {
          if (result.status === 'rejected') {
            console.error(
              `Agent Session directory lookup failed for ${projects[index]?.name}`,
              result.reason,
            )
          }
        })
        const path = normalizedPath(cwd)
        const match = directories
          .flatMap(result => (result.status === 'fulfilled' ? result.value : []))
          .filter(workspace => {
            const root = normalizedPath(workspace.path)
            return path === root || path.startsWith(root === '/' ? root : `${root}/`)
          })
          .toSorted(
            (left, right) =>
              normalizedPath(right.path).length - normalizedPath(left.path).length ||
              Number(right.primary) - Number(left.primary) ||
              left.projectName.localeCompare(right.projectName),
          )[0]
        setResolution({
          resource: match
            ? { type: 'session', projectName: match.projectName, provider, sessionId }
            : null,
          error: directories.some(result => result.status === 'rejected')
            ? 'Some project directories could not be loaded.'
            : null,
        })
      } catch (error) {
        if (signal.aborted) return
        console.error('Agent Session directory resolution failed', error)
        setResolution({ resource: null, error: 'The Session project could not be resolved.' })
      }
    },
    [projects, cwd, kind, provider, sessionId],
  )

  const retry = useCallback(() => {
    pending.current?.abort()
    const controller = new AbortController()
    pending.current = controller
    void load(controller.signal)
  }, [load])

  useEffect(() => {
    retry()
    return () => pending.current?.abort()
  }, [retry])

  const valid =
    cwd &&
    kind === 'id' &&
    sessionId &&
    (provider === 'codex' || provider === 'claude') &&
    projects.length > 0
  return {
    resource: valid ? resolution.resource : null,
    error: valid ? resolution.error : null,
    retry,
  }
}
