import type { AgentLaunchRecovery, AgentProvider, Project } from '@herdr-roam/shared'
import { Check, Copy, ExternalLink, TerminalSquare } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { WorkspaceSelect } from '../../../shell/context-sidebar/project-panel/workspace-select'
import { Button } from '../../../ui/button'
import type { ResourceRef } from '../../../workbench/resource'
import { AgentClientError, launchProjectAgent } from '../../agent/client'
import { useAgentRuntime } from '../../agent/runtime-provider'
import { useProjectWorkspaces } from '../../project/use-project-workspaces'

type LaunchOutcome = {
  readonly projectName: string
  readonly agentId?: string
  readonly failure?: { readonly message: string; readonly recovery: AgentLaunchRecovery | null }
}

export const AgentLauncher = ({
  project,
  onOpen,
  visible = true,
}: {
  readonly project: Project
  readonly onOpen: (resource: ResourceRef) => void
  readonly visible?: boolean
}) => {
  const { snapshot, registerStartedAgent } = useAgentRuntime()
  const workspaces = useProjectWorkspaces(project.name)
  const [provider, setProvider] = useState<AgentProvider>('codex')
  const [directory, setDirectory] = useState({ projectName: project.name, id: 'primary' })
  const [launching, setLaunching] = useState(false)
  const [outcome, setOutcome] = useState<LaunchOutcome | null>(null)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const launchPending = useRef(false)
  const context = useRef({ projectName: project.name, visible })
  if (directory.projectName !== project.name) {
    setDirectory({ projectName: project.name, id: 'primary' })
  }

  useLayoutEffect(() => {
    context.current = { projectName: project.name, visible }
    return () => {
      context.current = { ...context.current, visible: false }
    }
  }, [project.name, visible])

  const result = outcome?.projectName === project.name ? outcome : null
  const recovery = result?.failure?.recovery
  const runtimeAvailable = snapshot.source.state === 'connected' && !snapshot.stale
  const selected = workspaces.items.find(item => item.id === directory.id)
  const canLaunch =
    runtimeAvailable &&
    !workspaces.loading &&
    !workspaces.error &&
    Boolean(selected) &&
    directory.projectName === project.name &&
    !launching &&
    !recovery
  const providerLabel = provider === 'codex' ? 'Codex' : 'Claude'

  const launch = async () => {
    if (!canLaunch || launchPending.current) return
    const origin = context.current
    launchPending.current = true
    setLaunching(true)
    setOutcome(null)
    setCopyFeedback(null)
    try {
      const receipt = await launchProjectAgent({
        projectName: project.name,
        provider,
        workspaceId: directory.id,
      })
      registerStartedAgent(receipt.agent)
      setOutcome({ projectName: project.name, agentId: receipt.agent.id })
      if (context.current === origin && origin.visible) {
        onOpen({ type: 'agent', agentId: receipt.agent.id })
      }
    } catch (error) {
      console.error('Agent launch failed', error)
      setOutcome({
        projectName: project.name,
        failure: {
          message: error instanceof Error ? error.message : 'The Agent could not be started.',
          recovery: error instanceof AgentClientError ? error.recovery : null,
        },
      })
    } finally {
      launchPending.current = false
      setLaunching(false)
    }
  }

  const copyRecovery = async () => {
    if (!recovery) return
    try {
      await navigator.clipboard.writeText(recovery.attachCommand)
      setCopyFeedback('Copied')
    } catch (error) {
      console.error('Recovery command copy failed', error)
      setCopyFeedback('The recovery command could not be copied.')
    }
  }

  return (
    <div className="mt-7 max-w-xl">
      <form
        aria-label="New Session"
        onSubmit={event => {
          event.preventDefault()
          void launch()
        }}
      >
        <fieldset disabled={launching} className="m-0 grid min-w-0 gap-4 border-0 p-0">
          <div className="grid min-w-0 gap-1.5">
            <span className="text-xs font-medium">Working directory</span>
            {workspaces.loading ? (
              <p className="m-0 py-2 text-xs text-muted" role="status">
                Loading directories…
              </p>
            ) : workspaces.error ? (
              <div className="flex items-center gap-2 text-xs text-danger" role="alert">
                <span className="min-w-0 flex-1">{workspaces.error.message}</span>
                <Button size="compact" onClick={workspaces.retry}>
                  Retry directories
                </Button>
              </div>
            ) : (
              <>
                <WorkspaceSelect
                  items={workspaces.items}
                  value={directory.id}
                  layout="field"
                  label="Working directory"
                  showSingle
                  disabled={launching}
                  onValueChange={id => {
                    setDirectory({ projectName: project.name, id })
                    if (!recovery) setOutcome(null)
                  }}
                />
                <p className="m-0 break-all font-mono text-[0.6875rem] leading-5 text-muted">
                  {selected?.path ?? 'Selected directory is unavailable. Choose another directory.'}
                </p>
              </>
            )}
          </div>
          <label className="grid gap-1.5 text-xs font-medium">
            Provider
            <select
              aria-label="Agent provider"
              value={provider}
              className="h-9 w-40 rounded-sm border border-border bg-surface px-2 text-xs text-foreground outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              onChange={event => {
                const value = event.target.value
                if (value === 'codex' || value === 'claude') setProvider(value)
              }}
            >
              <option value="codex">Codex</option>
              <option value="claude">Claude</option>
            </select>
          </label>
          <div className="mt-1 flex justify-end">
            <Button type="submit" variant="primary" disabled={!canLaunch}>
              <TerminalSquare aria-hidden="true" />
              {launching ? 'Opening…' : `Open ${providerLabel}`}
            </Button>
          </div>
        </fieldset>
      </form>
      {!runtimeAvailable && (
        <p className="mt-3 mb-0 text-xs text-muted" role="status">
          {snapshot.source.state === 'connected'
            ? 'Herdr runtime state is stale.'
            : `${snapshot.source.message} Check Runtime status at the bottom left for setup.`}
        </p>
      )}
      {launching && (
        <p className="mt-3 mb-0 text-xs text-muted" role="status">
          Opening the native Agent…
        </p>
      )}
      {result?.agentId && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted" role="status">
          <Check aria-hidden="true" className="size-3.5" /> Agent opened.
          <Button
            size="compact"
            onClick={() => onOpen({ type: 'agent', agentId: result.agentId ?? '' })}
          >
            <ExternalLink aria-hidden="true" /> Open Agent
          </Button>
        </div>
      )}
      {result?.failure && (
        <div className="mt-3 rounded-md border border-danger/30 bg-danger/8 p-3 text-xs">
          <p className="m-0 text-danger" role="alert">
            {result.failure.message}
            {recovery && ' The runtime workspace was kept for recovery.'}
          </p>
          {recovery && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {recovery.agentId && (
                <Button
                  size="compact"
                  onClick={() => onOpen({ type: 'agent', agentId: recovery.agentId ?? '' })}
                >
                  <ExternalLink aria-hidden="true" /> Open Agent
                </Button>
              )}
              <Button size="compact" onClick={() => void copyRecovery()}>
                <Copy aria-hidden="true" /> Copy attach
              </Button>
              <Button
                size="compact"
                onClick={() => {
                  setOutcome(null)
                  setCopyFeedback(null)
                }}
              >
                Start another Agent
              </Button>
              {copyFeedback && <span role="status">{copyFeedback}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
