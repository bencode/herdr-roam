import type { AgentLaunchRecovery, AgentProvider, Project } from '@herdr-roam/shared'
import { ArrowUp, Check, Copy, ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../../ui/button'
import type { ResourceRef } from '../../../workbench/resource'
import { AgentClientError, launchProjectAgent } from '../../agent/client'
import { useAgentRuntime } from '../../agent/runtime-provider'

export const AgentLauncher = ({
  project,
  onOpen,
}: {
  readonly project: Project
  readonly onOpen: (resource: ResourceRef) => void
}) => {
  const { snapshot } = useAgentRuntime()
  const [provider, setProvider] = useState<AgentProvider>('codex')
  const [prompt, setPrompt] = useState('')
  const [launching, setLaunching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recovery, setRecovery] = useState<AgentLaunchRecovery | null>(null)
  const [copied, setCopied] = useState(false)
  const runtimeAvailable = snapshot.source.state === 'connected' && !snapshot.stale
  const canLaunch = runtimeAvailable && prompt.trim().length > 0 && !launching

  const launch = async () => {
    if (!canLaunch) return
    setLaunching(true)
    setError(null)
    setRecovery(null)
    try {
      const receipt = await launchProjectAgent({
        projectName: project.name,
        provider,
        prompt,
      })
      setPrompt('')
      onOpen({ type: 'agent', agentId: receipt.agent.id })
    } catch (launchError) {
      console.error('Agent launch failed', launchError)
      setError(launchError instanceof Error ? launchError.message : 'The Agent could not be started.')
      setRecovery(launchError instanceof AgentClientError ? launchError.recovery : null)
    } finally {
      setLaunching(false)
    }
  }

  const copyRecovery = async () => {
    if (!recovery) return
    try {
      await navigator.clipboard.writeText(recovery.attachCommand)
      setCopied(true)
      setTimeout(() => setCopied(false), 1_500)
    } catch (copyError) {
      console.error('Recovery command copy failed', copyError)
      setError('The recovery command could not be copied.')
    }
  }

  return (
    <div className="mt-8">
      <form
        className="rounded-lg border border-border bg-background p-3"
        onSubmit={event => {
          event.preventDefault()
          void launch()
        }}
      >
        <textarea
          className="block min-h-20 w-full resize-none border-0 bg-transparent p-1 text-sm outline-0 placeholder:text-faint"
          value={prompt}
          onChange={event => {
            setPrompt(event.target.value)
            setError(null)
            setRecovery(null)
          }}
          placeholder="Describe the work…"
          aria-label="Describe the work"
        />
        <div className="mt-2 flex items-center gap-3 text-faint text-xs">
          <label className="flex items-center gap-1.5">
            <span className="sr-only">Agent provider</span>
            <select
              className="h-7 rounded-sm border-0 bg-transparent px-1 text-muted outline-none hover:bg-hover focus:bg-hover"
              value={provider}
              onChange={event => setProvider(event.target.value as AgentProvider)}
              aria-label="Agent provider"
            >
              <option value="codex">Codex</option>
              <option value="claude">Claude</option>
            </select>
          </label>
          <span className="min-w-0 truncate font-mono">{project.path}</span>
          <Button
            type="submit"
            className="ml-auto flex-none"
            disabled={!canLaunch}
            size="defaultIcon"
            variant="primary"
            aria-label={launching ? `Starting ${provider}` : `Start ${provider}`}
          >
            <ArrowUp className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </form>
      {!runtimeAvailable && (
        <p className="mt-2 mb-0 text-xs text-warning">
          {snapshot.source.state === 'connected'
            ? 'Herdr runtime state is stale.'
            : `${snapshot.source.message} Check Runtime status at the bottom left for setup.`}
        </p>
      )}
      {launching && (
        <p className="mt-2 mb-0 text-xs text-muted" role="status">
          Creating a Herdr Workspace and starting {provider}…
        </p>
      )}
      {error && (
        <div className="mt-2 flex min-h-8 items-center gap-2 rounded-md border border-danger/30 bg-danger/8 px-2.5 py-1.5 text-xs">
          <span className="min-w-0 flex-1 text-danger" role="alert">
            {error}
            {recovery && ' The Herdr Workspace was kept for recovery.'}
          </span>
          {recovery?.agentId && (
            <Button
              size="compact"
              onClick={() => onOpen({ type: 'agent', agentId: recovery.agentId ?? '' })}
            >
              <ExternalLink aria-hidden="true" /> Open Agent
            </Button>
          )}
          {recovery && (
            <Button size="compact" onClick={() => void copyRecovery()}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy attach'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
