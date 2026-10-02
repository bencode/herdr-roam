import type { AgentSummary } from '@herdr-roam/shared'
import { useState } from 'react'
import { useAgentRuntime } from '../agent/runtime-provider'
import { useProjectWorkspaces } from '../project/use-project-workspaces'

const SELECTION_KEY = 'herdr-roam.assistant-agent.v1'

type Selection = Readonly<Record<string, string>>

const readSelection = (): Selection => {
  try {
    const value: unknown = JSON.parse(globalThis.localStorage?.getItem(SELECTION_KEY) ?? '{}')
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value).filter(
            (entry): entry is [string, string] => typeof entry[1] === 'string',
          ),
        )
      : {}
  } catch (error) {
    console.error('Assistant Agent selection read failed', error)
    return {}
  }
}

const writeSelection = (selection: Selection): void => {
  try {
    globalThis.localStorage?.setItem(SELECTION_KEY, JSON.stringify(selection))
  } catch (error) {
    console.error('Assistant Agent selection write failed', error)
  }
}

const normalizedPath = (path: string): string =>
  path.replaceAll('\\', '/').replace(/\/+$/, '') || '/'

const within = (path: string, root: string): boolean => {
  const target = normalizedPath(path)
  const base = normalizedPath(root)
  return target === base || target.startsWith(base === '/' ? base : `${base}/`)
}

export const useAssistantAgent = (projectName: string) => {
  const { snapshot } = useAgentRuntime()
  const workspaces = useProjectWorkspaces(projectName)
  const [selection, setSelection] = useState(readSelection)
  const agents: readonly AgentSummary[] = snapshot.items.filter(
    agent =>
      agent.cwd !== null &&
      workspaces.items.some(workspace => within(agent.cwd ?? '', workspace.path)),
  )
  const remembered = agents.find(agent => agent.id === selection[projectName])
  const agent = remembered ?? (agents.length === 1 ? agents[0] : undefined) ?? null

  const select = (agentId: string) => {
    const next = { ...selection, [projectName]: agentId }
    setSelection(next)
    writeSelection(next)
  }

  return {
    agents,
    agent,
    loading: workspaces.loading,
    error: workspaces.error,
    retry: workspaces.retry,
    select,
  }
}
