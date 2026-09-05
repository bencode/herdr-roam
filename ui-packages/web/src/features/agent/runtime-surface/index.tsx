import type { AgentSummary } from '@herdr-roam/shared'
import { PromptComposer } from '../../prompt-composer'
import { TerminalOutput } from '../agent-tab/terminal-output'

export const AgentRuntimeSurface = ({
  agent,
  runtimeAvailable,
  unavailableMessage,
  onSubmitted,
  focusPrompt = false,
}: {
  readonly agent: AgentSummary
  readonly runtimeAvailable: boolean
  readonly unavailableMessage: string
  readonly onSubmitted?: () => void
  readonly focusPrompt?: boolean
}) => (
  <div className="flex min-h-0 min-w-0 flex-1 flex-col">
    <TerminalOutput
      agentId={agent.id}
      canRead={runtimeAvailable}
      canInput={runtimeAvailable && agent.status === 'blocked'}
    />
    {agent.status !== 'blocked' && (
      <PromptComposer
        focusWhenReady={focusPrompt}
        agentId={agent.id}
        status={agent.status}
        runtimeAvailable={runtimeAvailable}
        unavailableMessage={unavailableMessage}
        onSubmitted={onSubmitted}
      />
    )}
  </div>
)
