export type Project = {
  readonly name: string
  readonly path: string
}

export type ProjectRegistrySnapshot = {
  readonly configPath: string
  readonly projects: readonly Project[]
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
      | 'project_config_invalid'
      | 'project_config_unavailable'
      | 'internal_error'
    readonly message: string
    readonly configPath?: string
  }
}
