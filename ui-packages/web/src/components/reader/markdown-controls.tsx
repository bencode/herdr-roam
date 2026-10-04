import * as Popover from '@radix-ui/react-popover'
import { PanelRight, SunMoon, Type } from 'lucide-react'
import { Button } from '../../ui/button'
import { PopoverContent } from '../../ui/popover'
import { SegmentedControl } from '../../ui/segmented-control'
import type { MarkdownView } from './markdown-view'
import styles from './markdown-controls.module.scss'
import {
  READING_FONT_SIZE,
  type ReadingTheme,
  type ReadingWidth,
  useReadingPreferences,
} from './reading-preferences'

const themeOptions: readonly { readonly value: ReadingTheme; readonly label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'paper', label: 'Paper' },
  { value: 'dark', label: 'Dark' },
]

const widthOptions: readonly { readonly value: ReadingWidth; readonly label: string }[] = [
  { value: 'focused', label: 'Focused' },
  { value: 'full', label: 'Full width' },
]

const modeOptions = [
  { value: 'preview', label: 'Preview' },
  { value: 'source', label: 'Source' },
] as const

const settingLabelClass = 'mb-2 p-0 text-2xs font-medium text-muted'

const ReadingSettings = () => {
  const { fontSize, width, theme, update } = useReadingPreferences()

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button size="compactIcon" aria-label="Reading settings" title="Reading settings">
          <Type aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <PopoverContent className="grid w-70 gap-4 p-3.5" side="bottom" align="end" sideOffset={6}>
        <label className="grid gap-2">
          <span className="text-2xs font-medium text-muted">Text size</span>
          <div className="flex items-center gap-2.5 text-muted">
            <span className="text-2xs" aria-hidden="true">
              A
            </span>
            <input
              className="flex-1 accent-primary"
              type="range"
              min={READING_FONT_SIZE.min}
              max={READING_FONT_SIZE.max}
              step={1}
              value={fontSize}
              onChange={event => update({ fontSize: Number(event.target.value) })}
            />
            <span className="text-base" aria-hidden="true">
              A
            </span>
          </div>
        </label>
        <div className="grid">
          <span className={settingLabelClass}>Page width</span>
          <SegmentedControl
            size="sm"
            label="Page width"
            options={widthOptions}
            value={width}
            onValueChange={value => update({ width: value })}
            className="w-full [&>label]:flex-1 [&>label]:justify-center"
          />
        </div>
        <fieldset className="m-0 grid min-w-0 border-0 p-0">
          <legend className={settingLabelClass}>Theme</legend>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Reading theme">
            {themeOptions.map(option => (
              <label
                key={option.value}
                className="group grid cursor-pointer justify-items-center gap-1 text-2xs text-muted has-checked:text-foreground"
              >
                <input
                  className="sr-only"
                  type="radio"
                  name="reading-theme"
                  value={option.value}
                  checked={theme === option.value}
                  onChange={() => update({ theme: option.value })}
                />
                <span
                  className={`${styles.swatch} grid h-(--control-md) w-full place-items-center rounded-md border border-border text-sm font-semibold group-has-checked:outline-2 group-has-checked:outline-primary group-has-focus-visible:outline-2 group-has-focus-visible:outline-primary`}
                  data-theme={option.value}
                  aria-hidden="true"
                >
                  {option.value === 'auto' ? <SunMoon className="size-4.5" /> : 'Aa'}
                </span>
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </PopoverContent>
    </Popover.Root>
  )
}

export const MarkdownControls = ({
  view,
  showOutlineToggle,
}: {
  readonly view: MarkdownView
  readonly showOutlineToggle: boolean
}) => (
  <div className="flex flex-none items-center gap-1">
    <SegmentedControl
      size="sm"
      label="Markdown view"
      options={modeOptions}
      value={view.mode}
      onValueChange={view.setMode}
    />
    <ReadingSettings />
    {showOutlineToggle && view.mode === 'preview' && (
      <Button
        size="compactIcon"
        className="aria-pressed:bg-hover aria-pressed:text-foreground"
        aria-pressed={view.outlineOpen}
        aria-label="Toggle outline"
        title="Toggle outline"
        onClick={() => view.setOutlineOpen(!view.outlineOpen)}
      >
        <PanelRight aria-hidden="true" />
      </Button>
    )}
  </div>
)
