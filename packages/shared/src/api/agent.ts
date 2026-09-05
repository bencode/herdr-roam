export type AgentStatus = 'blocked' | 'working' | 'idle' | 'done' | 'unknown'
export type AgentProvider = 'codex' | 'claude'

export type AgentSessionRef = {
  readonly source: string
  readonly agent: string
  readonly kind: 'id' | 'path'
  readonly value: string
}

export type AgentSummary = {
  readonly id: string
  readonly name: string
  readonly provider: string | null
  readonly status: AgentStatus
  readonly cwd: string | null
  readonly attachTarget: string
  readonly session: AgentSessionRef | null
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
}

export type AgentOutput = {
  readonly agentId: string
  readonly text: string
  readonly truncated: boolean
}

export type AgentPromptRequest = {
  readonly text: string
}

export type AgentPromptReceipt = {
  readonly agentId: string
}

export const AGENT_PROMPT_IMAGE_MAX_COUNT = 4
export const AGENT_PROMPT_IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const AGENT_PROMPT_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
export const AGENT_TEXT_MAX_BYTES = 64 * 1024

export type AgentPromptImageType = (typeof AGENT_PROMPT_IMAGE_TYPES)[number]

export type AgentInputKey =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'enter'
  | 'esc'
  | 'tab'
  | 'shift+tab'
  | 'backspace'
  | 'delete'
  | 'home'
  | 'end'

export type AgentInputRequest =
  | {
      readonly type: 'keys'
      readonly keys: readonly AgentInputKey[]
    }
  | {
      readonly type: 'text'
      readonly text: string
    }

export type AgentInputReceipt = {
  readonly agentId: string
}

export type AgentStopReceipt = {
  readonly agentId: string
}

export type AgentLaunchRequest = {
  readonly projectName: string
  readonly provider: AgentProvider
  readonly workspaceId?: string
  readonly prompt?: string
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
      | 'invalid_agent_input'
      | 'agent_input_unavailable'
      | 'invalid_prompt_image'
      | 'agent_focus_unavailable'
      | 'agent_stop_unavailable'
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
