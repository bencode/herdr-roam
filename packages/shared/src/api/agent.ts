export type AgentStatus = 'blocked' | 'working' | 'idle' | 'done' | 'unknown'

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

export type AgentApiError = {
  readonly error: {
    readonly code:
      | 'agent_not_found'
      | 'runtime_unavailable'
      | 'agent_output_unavailable'
      | 'invalid_prompt'
      | 'agent_not_ready'
      | 'agent_prompt_unavailable'
      | 'internal_error'
    readonly message: string
  }
}
