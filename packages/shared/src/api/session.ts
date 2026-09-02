import type { AgentLaunchRecovery, AgentProvider, AgentSummary } from './agent.js'

export type SessionProvider = AgentProvider

export type SessionSummary = {
  readonly id: string
  readonly provider: SessionProvider
  readonly title: string
  readonly cwd: string
  readonly createdAt: string | null
  readonly updatedAt: string
}

export type SessionAttachment = {
  readonly id: string
  readonly kind: 'image'
  readonly name: string
}

export type SessionMessageEntry = {
  readonly kind: 'message'
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly createdAt: string | null
  readonly attachments: readonly SessionAttachment[]
}

export type SessionActivityEntry = {
  readonly kind: 'activity'
  readonly id: string
  readonly name: string
  readonly status: 'pending' | 'completed' | 'failed'
  readonly input: string | null
  readonly output: string | null
  readonly createdAt: string | null
}

export type SessionOmissionEntry = {
  readonly kind: 'omission'
  readonly id: string
  readonly bytes: number
  readonly createdAt: null
}

export type SessionEntry = SessionMessageEntry | SessionActivityEntry | SessionOmissionEntry

export type SessionHistoryPage = SessionSummary & {
  readonly mode: 'page'
  readonly entries: readonly SessionEntry[]
  readonly olderCursor: string | null
  readonly tailCursor: string
  readonly atLatest: boolean
}

export type SessionActivityUpdate = {
  readonly id: string
  readonly status: SessionActivityEntry['status']
  readonly output: string | null
}

export type SessionHistoryDelta = {
  readonly mode: 'delta'
  readonly entries: readonly SessionEntry[]
  readonly activityUpdates: readonly SessionActivityUpdate[]
  readonly tailCursor: string
  readonly caughtUp: boolean
}

export type SessionCatalog = {
  readonly items: readonly SessionSummary[]
  readonly total: number
  readonly nextCursor: string | null
}

export type SessionResumeReceipt = {
  readonly agent: AgentSummary
  readonly reused: boolean
}

export type SessionApiError = {
  readonly error: {
    readonly code:
      | 'invalid_session'
      | 'session_not_found'
      | 'session_history_unavailable'
      | 'session_history_changed'
      | 'session_directory_unavailable'
      | 'session_resume_unavailable'
      | 'runtime_unavailable'
      | 'project_not_found'
      | 'internal_error'
    readonly message: string
    readonly recovery?: AgentLaunchRecovery
  }
}
