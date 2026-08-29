import { Braces, Eye, FileText } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../../lib/cn'
import { fileByPath, projectByName } from '../../../mock/data'
import { Markdown } from '../../../ui/markdown'
import type { ResourceRef } from '../../../workbench/resource'

type MarkdownMode = 'preview' | 'source'

export const FileTab = ({
  resource,
}: {
  readonly resource: Extract<ResourceRef, { type: 'file' }>
}) => {
  const file = fileByPath(resource.projectName, resource.path)
  const project = projectByName(resource.projectName)
  const [mode, setMode] = useState<MarkdownMode>('preview')
  if (!file)
    return <p className="grid h-full place-items-center text-muted">File is unavailable.</p>
  const code = `\`\`\`${file.language}\n${file.content}\n\`\`\``
  const markdownPreview = file.language === 'markdown' && mode === 'preview'

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex min-h-12 items-center gap-2 border-border border-b px-4 [&>svg]:w-4 [&>svg]:flex-none [&>svg]:text-primary">
        {file.language === 'markdown' ? <FileText /> : <Braces />}
        <p className="m-0 min-w-0 truncate">
          <span className="text-muted">{project?.name} / </span>
          {file.path}
        </p>
        {file.language === 'markdown' && (
          <div className="ml-auto flex rounded-md border border-border p-0.5">
            {(['preview', 'source'] as const).map(value => (
              <button
                type="button"
                key={value}
                className={cn(
                  'flex h-7 items-center gap-1.5 rounded-[3px] border-0 bg-transparent px-2.5 text-xs text-muted hover:text-foreground [&_svg]:w-3.5',
                  mode === value && 'bg-raised text-foreground',
                )}
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
              >
                {value === 'preview' && <Eye />}
                {value}
              </button>
            ))}
          </div>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-[clamp(1.5rem,4vw,2.5rem)] py-8">
        <div className="mx-auto max-w-3xl">
          {markdownPreview ? <Markdown text={file.content} /> : <Markdown text={code} />}
        </div>
      </div>
    </div>
  )
}
