export type CompareBranch = {
  readonly ref: string
  readonly name: string
  readonly oid: string
}

export type CompareBranches = {
  readonly items: readonly CompareBranch[]
  readonly defaultTargetRef: string | null
}

export type CompareFile = {
  readonly oldPath: string | null
  readonly newPath: string | null
  readonly oldMode: string | null
  readonly newMode: string | null
  readonly status: 'added' | 'modified' | 'deleted' | 'renamed' | 'type-changed'
  readonly added: number | null
  readonly removed: number | null
}

export type Comparison = {
  readonly source: CompareBranch
  readonly target: CompareBranch
  readonly baseOid: string
  readonly files: readonly CompareFile[]
}

export type CommittedText = {
  readonly path: string
  readonly content: string
}

export type CompareFileView =
  | {
      readonly kind: 'text'
      readonly entry: CompareFile
      readonly oldFile: CommittedText | null
      readonly newFile: CommittedText | null
    }
  | {
      readonly kind: 'unavailable'
      readonly entry: CompareFile
      readonly reason: 'binary' | 'oversized' | 'submodule'
    }

export type CompareApiError = {
  readonly error: {
    readonly code:
      | 'invalid_query'
      | 'project_not_found'
      | 'repository_unavailable'
      | 'ref_not_found'
      | 'no_merge_base'
      | 'file_not_found'
      | 'comparison_too_large'
      | 'git_timeout'
      | 'internal_error'
    readonly message: string
  }
}
