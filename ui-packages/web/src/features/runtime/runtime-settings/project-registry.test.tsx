import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProjectRegistry } from './project-registry'

describe('Runtime Project registry', () => {
  it('confirms an observed directory before adding it', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(
      <ProjectRegistry
        projects={[]}
        observedDirectories={[
          {
            path: '/work/herdr-roam',
            suggestedName: 'herdr-roam',
            agentCount: 1,
            paneCount: 2,
          },
        ]}
        configPath="/tmp/herdr-roam/config.json"
        loadError={null}
        onAdd={onAdd}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByRole('textbox', { name: 'Project absolute path' })).toHaveValue(
      '/work/herdr-roam',
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Project name' }), {
      target: { value: 'roam' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add project' }))

    await waitFor(() =>
      expect(onAdd).toHaveBeenCalledWith({ name: 'roam', path: '/work/herdr-roam' }),
    )
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'Project name' })).not.toBeInTheDocument(),
    )
  })

  it('keeps the manual form open when registration fails', async () => {
    const onAdd = vi.fn().mockRejectedValue(new Error('Project name is already registered.'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    render(
      <ProjectRegistry
        projects={[]}
        observedDirectories={[]}
        configPath="/tmp/herdr-roam/config.json"
        loadError={null}
        onAdd={onAdd}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add directory' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Project absolute path' }), {
      target: { value: '/work/herdr-roam' },
    })
    fireEvent.change(screen.getByRole('textbox', { name: 'Project name' }), {
      target: { value: 'herdr-roam' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add project' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('already registered')
    expect(screen.getByRole('textbox', { name: 'Project name' })).toHaveValue('herdr-roam')
  })
})
