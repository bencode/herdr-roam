import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, type LucideIcon, Monitor, Moon, Sun } from 'lucide-react'
import { useLayoutEffect, useState } from 'react'
import {
  applyThemePreference,
  isThemePreference,
  readThemePreference,
  type ThemePreference,
  writeThemePreference,
} from '../../../theme'

type ThemeOption = {
  readonly value: ThemePreference
  readonly label: string
  readonly icon: LucideIcon
}

const options: readonly ThemeOption[] = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
]

export const ThemeSelect = () => {
  const [theme, setTheme] = useState(readThemePreference)
  const selected = options.find(option => option.value === theme) ?? options[0]
  if (!selected) throw new Error('missing System theme option')
  const SelectedIcon = selected.icon

  useLayoutEffect(() => applyThemePreference(theme), [theme])

  const selectTheme = (value: string) => {
    if (!isThemePreference(value)) throw new Error(`invalid theme preference: ${value}`)
    setTheme(value)
    writeThemePreference(value)
  }

  return (
    <SelectPrimitive.Root value={theme} onValueChange={selectTheme}>
      <SelectPrimitive.Trigger
        className="grid size-11 place-items-center border-0 bg-transparent text-muted hover:bg-hover hover:text-foreground data-[state=open]:bg-hover data-[state=open]:text-foreground"
        aria-label={`Theme: ${selected.label}`}
        title={`Theme: ${selected.label}`}
      >
        <SelectedIcon className="size-4" aria-hidden="true" />
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="z-[var(--z-dropdown)] min-w-36 overflow-hidden rounded-md border border-border bg-surface p-1 text-foreground shadow-[var(--shadow-popover)]"
          position="popper"
          side="right"
          align="end"
          sideOffset={4}
          collisionPadding={8}
        >
          <SelectPrimitive.Viewport>
            {options.map(option => {
              const Icon = option.icon
              return (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className="relative flex h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 pr-8 outline-none data-[highlighted]:bg-hover data-[state=checked]:font-semibold"
                >
                  <Icon className="size-3.5 text-muted" aria-hidden="true" />
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="absolute right-2 grid size-4 place-items-center text-primary">
                    <Check className="size-3.5" aria-hidden="true" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              )
            })}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
