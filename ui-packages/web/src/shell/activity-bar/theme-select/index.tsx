import * as Popover from '@radix-ui/react-popover'
import { Check, type LucideIcon, Monitor, Moon, Sun } from 'lucide-react'
import { useLayoutEffect, useState } from 'react'
import { menuItemVariants } from '../../../ui/menu'
import { PopoverContent } from '../../../ui/popover'
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
          className="m-1 grid size-9 place-items-center rounded-md border-0 bg-transparent text-muted hover:bg-hover hover:text-foreground data-[state=open]:bg-hover data-[state=open]:text-foreground [&_svg]:size-4"
          title={`Theme: ${selected.label}`}
          aria-label={`Theme: ${selected.label}`}
        >
          <SelectedIcon aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <PopoverContent className="min-w-36 p-1" side="right" align="end">
        <div role="radiogroup" aria-label="Theme">
          {options.map(option => {
            const Icon = option.icon
            const optionSelected = option.value === theme
            return (
              <label
                key={option.value}
                className={menuItemVariants({ className: 'focus-within:bg-hover' })}
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="theme"
                  value={option.value}
                  checked={optionSelected}
                  onChange={() => selectTheme(option.value)}
                />
                <Icon className="text-muted" aria-hidden="true" />
                <span>{option.label}</span>
                {optionSelected && <Check className="ml-auto text-primary" aria-hidden="true" />}
              </label>
            )
          })}
        </div>
      </PopoverContent>
    </Popover.Root>
  )
}
