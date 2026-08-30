export type Project = {
  readonly name: string
  readonly path: string
}

export type ObservedProjectDirectory = {
  readonly path: string
  readonly suggestedName: string
  readonly agentCount: number
  readonly paneCount: number
}

export type ProjectRegistrySnapshot = {
  readonly configPath: string
  readonly projects: readonly Project[]
}

export type ProjectCreateRequest = {
  readonly name: string
  readonly path: string
}

export type ProjectCreateReceipt = ProjectRegistrySnapshot & {
  readonly project: Project
}

export type ProjectApiError = {
  readonly error: {
    readonly code:
      | 'invalid_project'
      | 'project_name_taken'
      | 'project_path_taken'
      | 'project_directory_unavailable'
      | 'project_config_invalid'
      | 'project_config_unavailable'
      | 'internal_error'
    readonly message: string
    readonly configPath?: string
  }
}
