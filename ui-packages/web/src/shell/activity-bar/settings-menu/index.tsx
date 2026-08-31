import * as Popover from '@radix-ui/react-popover'
import { Check, type LucideIcon, Monitor, Moon, Settings, Sun } from 'lucide-react'
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

export const SettingsMenu = () => {
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useState(readThemePreference)

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
          title="Settings"
          aria-label="Settings"
        >
          <Settings aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-[var(--z-dropdown)] w-44 rounded-md border border-border bg-surface p-1.5 text-foreground shadow-[var(--shadow-popover)]"
          side="right"
          align="end"
          sideOffset={4}
          collisionPadding={8}
        >
          <p className="m-0 px-2 pt-1 pb-1.5 text-xs font-semibold">Settings</p>
          <div role="radiogroup" aria-label="Theme">
            <p className="m-0 px-2 py-1 text-[0.6875rem] font-medium text-muted">Theme</p>
            {options.map(option => {
              const Icon = option.icon
              const selected = option.value === theme
              return (
                <label
                  key={option.value}
                  className="flex h-8 w-full cursor-default items-center gap-2 rounded-sm border-0 bg-transparent px-2 text-left text-sm text-foreground outline-none hover:bg-hover focus-within:bg-hover"
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="theme"
                    value={option.value}
                    checked={selected}
                    onChange={() => selectTheme(option.value)}
                  />
                  <Icon className="size-3.5 text-muted" aria-hidden="true" />
                  <span>{option.label}</span>
                  {selected && (
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
