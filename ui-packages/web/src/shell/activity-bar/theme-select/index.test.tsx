import { fireEvent, render, screen } from '@testing-library/react'
import { THEME_STORAGE_KEY } from '../../../theme'
import { ThemeSelect } from '.'

describe('ThemeSelect', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
  })

  it('selects and persists a theme from the direct Theme control', () => {
    render(<ThemeSelect />)

    expect(document.documentElement).toHaveAttribute('data-theme', 'system')
    fireEvent.click(screen.getByRole('button', { name: 'Theme: System' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }))

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(screen.getByRole('button', { name: 'Theme: Dark' })).toBeVisible()
    expect(screen.queryByRole('radiogroup', { name: 'Theme' })).not.toBeInTheDocument()
  })
})
