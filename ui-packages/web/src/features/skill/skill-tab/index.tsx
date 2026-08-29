import { Box, FileCode2 } from 'lucide-react'
import { skillById } from '../../../mock/data'
import { Markdown } from '../../../ui/markdown'
import type { ResourceRef } from '../../../workbench/resource'

export const SkillTab = ({
  resource,
}: {
  readonly resource: Extract<ResourceRef, { type: 'skill' }>
}) => {
  const skill = skillById(resource.skillId)
  if (!skill)
    return <p className="grid h-full place-items-center text-muted">Skill is unavailable.</p>

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex min-h-12 items-center gap-2 border-border border-b px-4 [&>svg]:w-4 [&>svg]:text-primary">
        <Box />
        <strong>{skill.name}</strong>
        <span className="rounded-full bg-raised px-2 py-0.5 text-xs text-muted">{skill.scope}</span>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-[clamp(1.5rem,4vw,2.5rem)] py-8">
        <div className="mx-auto grid max-w-4xl gap-10 min-[64rem]:grid-cols-[minmax(0,1fr)_220px]">
          <Markdown text={skill.markdown} />
          <aside className="border-border border-t pt-4 min-[64rem]:border-t-0 min-[64rem]:border-l min-[64rem]:pt-0 min-[64rem]:pl-5">
            <p className="mt-0 mb-3 text-xs text-muted">Supporting resources</p>
            {skill.resources.map(item => (
              <div key={item} className="flex items-center gap-2 py-2 text-sm">
                <FileCode2 className="w-3.5 flex-none text-primary" />
                <span className="min-w-0 truncate font-mono text-xs">{item}</span>
              </div>
            ))}
          </aside>
        </div>
      </div>
    </div>
  )
}
