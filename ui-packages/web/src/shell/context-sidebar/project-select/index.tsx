import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import type { Project } from '../../../mock/data'

type Props = {
  readonly projects: readonly Project[]
  readonly value: string
  readonly onValueChange: (projectName: string) => void
}

export const ProjectSelect = ({ projects, value, onValueChange }: Props) => {
  return (
    <div className="min-w-0 flex-1">
      <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
        <SelectPrimitive.Trigger
          className="flex h-7.5 w-full items-center justify-between gap-2 rounded-sm border-0 bg-transparent px-2 text-left font-semibold transition-colors duration-150 hover:bg-hover data-[state=open]:bg-hover [&>span:first-child]:truncate"
          aria-label="Active project"
        >
          <SelectPrimitive.Value />
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="w-3.5 flex-none text-muted" aria-hidden="true" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="z-[var(--z-dropdown)] max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border bg-surface text-foreground shadow-[var(--shadow-popover)]"
            position="popper"
            align="start"
            sideOffset={4}
          >
            <SelectPrimitive.Viewport className="p-1">
              {projects.map(project => (
                <SelectPrimitive.Item
                  key={project.name}
                  value={project.name}
                  className="relative flex h-7.5 cursor-default select-none items-center rounded-sm px-2 pr-8 outline-0 data-[disabled]:pointer-events-none data-[disabled]:opacity-45 data-[highlighted]:bg-hover data-[state=checked]:font-semibold data-[state=checked]:text-foreground"
                >
                  <SelectPrimitive.ItemText>{project.name}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-2 grid size-4 place-items-center text-primary">
                    <Check className="w-3.25" aria-hidden="true" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  )
}
