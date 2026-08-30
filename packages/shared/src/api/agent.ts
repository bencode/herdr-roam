import type { ObservedProjectDirectory } from './project.js'

export type AgentStatus = 'blocked' | 'working' | 'idle' | 'done' | 'unknown'
export type AgentProvider = 'codex' | 'claude'

export type AgentSummary = {
  readonly id: string
  readonly name: string
  readonly provider: string | null
  readonly status: AgentStatus
  readonly cwd: string | null
  readonly attachTarget: string
}

export type AgentRuntimeSnapshot = {
  readonly source:
    | {
        readonly state: 'connected'
        readonly version: string
        readonly protocol: number
      }
    | {
        readonly state: 'reconnecting' | 'unavailable'
        readonly code:
          | 'herdr_missing'
          | 'herdr_not_running'
          | 'protocol_incompatible'
          | 'herdr_unavailable'
        readonly message: string
      }
  readonly stale: boolean
  readonly items: readonly AgentSummary[]
  readonly observedDirectories: readonly ObservedProjectDirectory[]
}

export type AgentOutput = {
  readonly agentId: string
  readonly text: string
}

export type AgentPromptRequest = {
  readonly text: string
}

export type AgentPromptReceipt = {
  readonly agentId: string
}

export type AgentLaunchRequest = {
  readonly projectName: string
  readonly provider: AgentProvider
  readonly prompt: string
}

export type AgentLaunchReceipt = {
  readonly agent: AgentSummary
  readonly workspaceId: string
  readonly paneId: string
}

export type AgentLaunchRecovery = {
  readonly phase: 'agent_start' | 'agent_ready' | 'initial_prompt'
  readonly workspaceId: string
  readonly paneId: string
  readonly terminalId: string
  readonly agentId?: string
  readonly attachCommand: string
}

export type AgentApiError = {
  readonly error: {
    readonly code:
      | 'agent_not_found'
      | 'runtime_unavailable'
      | 'agent_output_unavailable'
      | 'invalid_prompt'
      | 'agent_not_ready'
      | 'agent_prompt_unavailable'
      | 'agent_focus_unavailable'
      | 'invalid_agent_launch'
      | 'project_not_found'
      | 'project_directory_unavailable'
      | 'agent_launch_unavailable'
      | 'agent_start_timeout'
      | 'agent_kind_mismatch'
      | 'internal_error'
    readonly message: string
    readonly recovery?: AgentLaunchRecovery
  }
}
