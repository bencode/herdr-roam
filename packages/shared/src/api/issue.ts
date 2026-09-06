export type IssueStatus = 'open' | 'closed'
export type IssueType = 'task' | 'bug' | 'feature'
export type IssuePriority = 'p0' | 'p1' | 'p2' | 'p3'

export type IssueSummary = {
  readonly id: string
  readonly title: string
  readonly status: IssueStatus
  readonly type?: IssueType
  readonly priority?: IssuePriority
  readonly labels: readonly string[]
  readonly path: string
}

export type IssueDetail = IssueSummary & {
  readonly body: string
}

export type IssueCatalogWarning = {
  readonly path: string
  readonly code: 'invalid_issue' | 'issue_unavailable'
  readonly message: string
}

export type IssueCatalog = {
  readonly items: readonly IssueSummary[]
  readonly warnings: readonly IssueCatalogWarning[]
}

export type IssueApiError = {
  readonly error: {
    readonly code:
      | 'issue_store_not_configured'
      | 'invalid_issue_config'
      | 'issue_store_unavailable'
      | 'invalid_issue'
      | 'issue_not_found'
      | 'issue_unavailable'
      | 'issue_catalog_too_large'
      | 'project_not_found'
      | 'project_directory_unavailable'
      | 'workspace_not_found'
      | 'workspace_directory_unavailable'
      | 'workspace_unavailable'
      | 'internal_error'
    readonly message: string
  }
}
