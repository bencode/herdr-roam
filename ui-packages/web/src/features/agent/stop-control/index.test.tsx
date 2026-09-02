import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AgentStopControl } from '.'

describe('Agent stop control', () => {
  it('requires confirmation before stopping', () => {
    const onStop = vi.fn()
    render(
      <AgentStopControl
        status="idle"
        stopping={false}
        historyAvailable
        onStop={onStop}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(screen.getByRole('heading', { name: 'Stop this Agent?' })).toBeVisible()
    expect(screen.getByText(/Session history stays available/)).toBeVisible()
    expect(onStop).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('heading', { name: 'Stop this Agent?' })).not.toBeInTheDocument()
    expect(onStop).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('heading', { name: 'Stop this Agent?' })).not.toBeInTheDocument()
    expect(onStop).not.toHaveBeenCalled()
  })

  it('warns about interruption and confirms the stop', () => {
    const onStop = vi.fn()
    render(
      <AgentStopControl
        status="working"
        stopping={false}
        historyAvailable={false}
        onStop={onStop}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(screen.getByText('Current work or pending input will be interrupted.')).toBeVisible()
    expect(screen.queryByText(/Session history stays available/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm stop' }))
    expect(onStop).toHaveBeenCalledOnce()
  })

  it('disables repeated actions while stopping', () => {
    render(
      <AgentStopControl
        status="idle"
        stopping
        historyAvailable={false}
        onStop={() => undefined}
      />,
    )
    expect(screen.getByRole('button', { name: 'Stopping…' })).toBeDisabled()
  })
})
