import * as Popover from '@radix-ui/react-popover'
import { Check, type LucideIcon, Monitor, Moon, Sun } from 'lucide-react'
import { useLayoutEffect, useState } from 'react'
import {
  applyThemePreference,
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
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState(readThemePreference)
  const selected = options.find(option => option.value === theme)
  if (!selected) throw new Error(`missing theme option: ${theme}`)
  const SelectedIcon = selected.icon

  useLayoutEffect(() => applyThemePreference(theme), [theme])

  const selectTheme = (nextTheme: ThemePreference) => {
    setTheme(nextTheme)
    writeThemePreference(nextTheme)
    setOpen(false)
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="m-1 grid size-9 place-items-center rounded-md border-0 bg-transparent text-muted hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[state=open]:bg-hover data-[state=open]:text-foreground [&_svg]:size-4"
          title={`Theme: ${selected.label}`}
          aria-label={`Theme: ${selected.label}`}
        >
          <SelectedIcon aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-[var(--z-dropdown)] min-w-36 rounded-md border border-border bg-surface p-1 text-foreground shadow-[var(--shadow-popover)]"
          side="right"
          align="end"
          sideOffset={4}
          collisionPadding={8}
        >
          <div role="radiogroup" aria-label="Theme">
            {options.map(option => {
              const Icon = option.icon
              const optionSelected = option.value === theme
              return (
                <label
                  key={option.value}
                  className="flex h-8 w-full cursor-default items-center gap-2 rounded-sm px-2 text-left text-sm text-foreground outline-none hover:bg-hover focus-within:bg-hover"
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="theme"
                    value={option.value}
                    checked={optionSelected}
                    onChange={() => selectTheme(option.value)}
                  />
                  <Icon className="size-3.5 text-muted" aria-hidden="true" />
                  <span>{option.label}</span>
                  {optionSelected && (
                    <Check className="ml-auto size-3.5 text-primary" aria-hidden="true" />
                  )}
                </label>
              )
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
