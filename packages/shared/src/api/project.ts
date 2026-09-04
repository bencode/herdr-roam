export type Project = {
  readonly name: string
  readonly path: string
}

export type ProjectRegistrySnapshot = {
  readonly configPath: string
  readonly projects: readonly Project[]
}

export type ProjectWorkspace = {
  readonly id: string
  readonly name: string
  readonly path: string
  readonly kind: 'directory' | 'worktree'
  readonly branch: string | null
  readonly primary: boolean
}

export type ProjectWorkspaceCatalog = {
  readonly items: readonly ProjectWorkspace[]
}

export type ProjectCreateRequest = {
  readonly path: string
}

export type ProjectMutationReceipt = ProjectRegistrySnapshot & {
  readonly project: Project
}

export type ProjectApiError = {
  readonly error: {
    readonly code:
      | 'invalid_project'
      | 'project_not_found'
      | 'project_directory_unavailable'
      | 'workspace_unavailable'
      | 'project_config_invalid'
      | 'project_config_unavailable'
      | 'internal_error'
    readonly message: string
    readonly configPath?: string
  }
}
