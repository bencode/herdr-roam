import * as Popover from '@radix-ui/react-popover'
import { PanelRight, SunMoon, Type } from 'lucide-react'
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

const ReadingSettings = () => {
  const { fontSize, width, theme, update } = useReadingPreferences()

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Reading settings"
          title="Reading settings"
        >
          <Type aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className={styles.settings}
          side="bottom"
          align="end"
          sideOffset={6}
          collisionPadding={8}
        >
          <label className={styles.setting}>
            <span>Text size</span>
            <div className={styles.slider}>
              <span aria-hidden="true">A</span>
              <input
                type="range"
                min={READING_FONT_SIZE.min}
                max={READING_FONT_SIZE.max}
                step={1}
                value={fontSize}
                onChange={event => update({ fontSize: Number(event.target.value) })}
              />
              <span aria-hidden="true">A</span>
            </div>
          </label>
          <fieldset className={styles.setting}>
            <legend>Page width</legend>
            <div className={styles.segmented}>
              {widthOptions.map(option => (
                <button
                  type="button"
                  key={option.value}
                  data-active={width === option.value || undefined}
                  aria-pressed={width === option.value}
                  onClick={() => update({ width: option.value })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className={styles.setting}>
            <legend>Theme</legend>
            <div className={styles.swatches} role="radiogroup" aria-label="Reading theme">
              {themeOptions.map(option => (
                <label key={option.value} data-active={theme === option.value || undefined}>
                  <input
                    className="sr-only"
                    type="radio"
                    name="reading-theme"
                    value={option.value}
                    checked={theme === option.value}
                    onChange={() => update({ theme: option.value })}
                  />
                  <span className={styles.swatch} data-theme={option.value} aria-hidden="true">
                    {option.value === 'auto' ? <SunMoon /> : 'Aa'}
                  </span>
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </Popover.Content>
      </Popover.Portal>
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
  <div className={styles.controls}>
    <fieldset className={styles.modes}>
      <legend className="sr-only">Markdown view</legend>
      {(['preview', 'source'] as const).map(value => (
        <button
          type="button"
          key={value}
          data-active={view.mode === value || undefined}
          aria-pressed={view.mode === value}
          onClick={() => view.setMode(value)}
        >
          {value}
        </button>
      ))}
    </fieldset>
    <ReadingSettings />
    {showOutlineToggle && view.mode === 'preview' && (
      <button
        type="button"
        className={styles.iconButton}
        data-active={view.outlineOpen || undefined}
        aria-pressed={view.outlineOpen}
        aria-label="Toggle outline"
        title="Toggle outline"
        onClick={() => view.setOutlineOpen(!view.outlineOpen)}
      >
        <PanelRight aria-hidden="true" />
      </button>
    )}
  </div>
)
