export type FileEntry = {
  readonly kind: 'directory' | 'file'
  readonly name: string
  readonly path: string
}

export type FilePage = {
  readonly items: readonly FileEntry[]
  readonly total: number
  readonly nextCursor: string | null
}

export type FileMetadata = {
  readonly path: string
  readonly name: string
  readonly size: number
  readonly modifiedAt: string
  readonly mediaType: string
}

type TextFileView = {
  readonly [Kind in 'markdown' | 'html' | 'mermaid' | 'text']: FileMetadata & {
    readonly kind: Kind
    readonly language: string
    readonly content: string
  }
}['markdown' | 'html' | 'mermaid' | 'text']

export type FileView =
  | TextFileView
  | (FileMetadata & { readonly kind: 'image' })
  | (FileMetadata & { readonly kind: 'binary' })
  | (FileMetadata & {
      readonly kind: 'oversized'
      readonly previewKind: 'text' | 'image'
      readonly limit: number
    })

export type ProjectFileEntry = FileEntry
export type ProjectFilePage = FilePage
export type ProjectFileMetadata = FileMetadata
export type ProjectFileView = FileView

export type ProjectFileApiError = {
  readonly error: {
    readonly code:
      | 'invalid_path'
      | 'invalid_cursor'
      | 'project_not_found'
      | 'project_directory_unavailable'
      | 'file_not_found'
      | 'file_unavailable'
      | 'file_unsupported'
      | 'catalog_too_large'
      | 'internal_error'
    readonly message: string
  }
}
