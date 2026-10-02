import type { AgentStatus } from '@herdr-roam/shared'
import { useEffect, useRef } from 'react'
import type { ResourceRef } from '../../workbench/resource'
import { type SessionDataState, useSessionData } from './use-session-data'

type SessionResource = Extract<ResourceRef, { type: 'session' }>

export const useLiveSession = (
  resource: SessionResource,
  status: AgentStatus | null,
  active: boolean,
): SessionDataState => {
  const data = useSessionData(
    resource.projectName,
    resource.provider,
    resource.sessionId,
    active && status === 'working',
  )
  const previousStatus = useRef(status)

  useEffect(() => {
    if (previousStatus.current === 'working' && status !== 'working' && !data.hasNewer) {
      data.reload()
    }
    previousStatus.current = status
  }, [status, data.hasNewer, data.reload])

  return data
}
