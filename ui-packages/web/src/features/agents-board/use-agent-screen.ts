import type { AgentStatus } from '@herdr-roam/shared'
import { type RefObject, useEffect, useState } from 'react'
import { fetchAgentOutput } from '../agent/client'

const SCREEN_LINES = 40

const pollInterval: Readonly<Partial<Record<AgentStatus, number>>> = {
  working: 1_000,
  blocked: 2_000,
}

const useVisible = (target: RefObject<HTMLElement | null>): boolean => {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const node = target.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? false),
      {
        rootMargin: '200px',
      },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [target])
  return visible
}

export const useAgentScreen = (
  agentId: string,
  status: AgentStatus,
  target: RefObject<HTMLElement | null>,
) => {
  const visible = useVisible(target)
  const interval = pollInterval[status]
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!visible || interval === undefined) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async () => {
      if (!document.hidden) {
        try {
          const output = await fetchAgentOutput(agentId, {
            lines: SCREEN_LINES,
            signal: controller.signal,
          })
          setText(output.text)
          setError(null)
        } catch (failure) {
          if (controller.signal.aborted) return
          console.error('Agent screen refresh failed', failure)
          setError(failure instanceof Error ? failure.message : 'The screen could not be read.')
        }
      }
      if (!controller.signal.aborted) timer = setTimeout(() => void tick(), interval)
    }
    void tick()
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [agentId, interval, visible])

  return { text, error }
}
