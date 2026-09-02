import type { AgentRuntimeSnapshot } from '@herdr-roam/shared'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RuntimeStatus } from '.'

const unavailable = (
  code: 'herdr_missing' | 'herdr_not_running' | 'protocol_incompatible' | 'herdr_unavailable',
  message: string,
): AgentRuntimeSnapshot => ({
  source: { state: 'unavailable', code, message },
  stale: false,
  items: [],
})

describe('Runtime status', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => vi.restoreAllMocks())

  it('shows the manual server command and copies it', async () => {
    render(
      <RuntimeStatus
        snapshot={unavailable('herdr_not_running', 'The default Herdr server is not running.')}
        transportError={null}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Runtime status: offline' }))
    expect(screen.getByText('herdr server')).toBeVisible()
    expect(screen.getByText(/connects automatically/)).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('herdr server'))
  })

  it('guides installation only when Herdr is missing', () => {
    render(
      <RuntimeStatus
        snapshot={unavailable('herdr_missing', 'Herdr is not installed or is not on PATH.')}
        transportError={null}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Runtime status: offline' }))
    expect(screen.getByText('curl -fsSL https://herdr.dev/install.sh | sh')).toBeVisible()
    expect(screen.getByRole('link', { name: /Installation guide/ })).toHaveAttribute(
      'href',
      'https://herdr.dev/docs/install/',
    )
    expect(screen.queryByText('herdr server')).not.toBeInTheDocument()
  })

  it('shows connected runtime facts without a command', () => {
    render(
      <RuntimeStatus
        snapshot={{
          source: { state: 'connected', version: '0.8.2', protocol: 20 },
          stale: false,
          items: [],
        }}
        transportError={null}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Runtime status: connected' }))
    expect(screen.getByText('Connected')).toBeVisible()
    expect(screen.getByText('0.8.2')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Copy' })).not.toBeInTheDocument()
  })
})
