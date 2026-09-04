import type { FileView } from './file.js'

export type SkillSource = 'agents' | 'codex' | 'claude'
export type SkillScope = 'user' | 'project'

export type SkillSummary = {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly source: SkillSource
  readonly scope: SkillScope
  readonly projectName?: string
  readonly location: string
}

export type SkillCatalogWarning = {
  readonly scope: SkillScope
  readonly source: SkillSource
  readonly location: string
  readonly code: 'invalid_skill' | 'skill_unavailable'
  readonly message: string
}

export type SkillCatalog = {
  readonly items: readonly SkillSummary[]
  readonly warnings: readonly SkillCatalogWarning[]
}

export type SkillDetail = SkillSummary & {
  readonly document: FileView
}

export type SkillApiError = {
  readonly error: {
    readonly code:
      | 'invalid_skill'
      | 'skill_not_found'
      | 'skill_unavailable'
      | 'project_not_found'
      | 'project_directory_unavailable'
      | 'invalid_path'
      | 'invalid_cursor'
      | 'file_not_found'
      | 'file_unavailable'
      | 'file_unsupported'
      | 'internal_error'
    readonly message: string
  }
}
