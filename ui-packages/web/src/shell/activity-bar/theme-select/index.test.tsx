import { fireEvent, render, screen } from '@testing-library/react'
import { THEME_STORAGE_KEY } from '../../../theme'
import { ThemeSelect } from '.'

describe('ThemeSelect', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('selects and persists a theme from an accessible popup', async () => {
    render(<ThemeSelect />)

    const trigger = screen.getByRole('combobox', { name: 'Theme: System' })
    expect(document.documentElement).toHaveAttribute('data-theme', 'system')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('option', { name: 'Dark' }))

    expect(screen.getByRole('combobox', { name: 'Theme: Dark' })).toBeVisible()
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })
})
