import type { Project } from '@herdr-roam/shared'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { ProjectSelect } from '.'

const initial: readonly Project[] = [
  { name: 'herdr-roam', path: '/work/herdr-roam' },
  { name: 'mission-control', path: '/work/mission-control' },
]

const ProjectSelectHarness = () => {
  const [projects, setProjects] = useState(initial)
  const [value, setValue] = useState('herdr-roam')
  return (
    <ProjectSelect
      projects={projects}
      value={value}
      error={null}
      configPath="/tmp/config.json"
      onValueChange={setValue}
      onAdd={async path => {
        const project = { name: 'new-project', path }
        setProjects(current => [...current, project])
        return project
      }}
      onRemove={async projectName => {
        setProjects(current => current.filter(project => project.name !== projectName))
      }}
    />
  )
}

describe('ProjectSelect', () => {
  it('switches Projects and adds a path without asking for a name', async () => {
    render(<ProjectSelectHarness />)
    const trigger = screen.getByRole('button', { name: 'Active project' })
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('button', { name: 'mission-control' }))
    expect(trigger).toHaveTextContent('mission-control')

    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('button', { name: 'Add project…' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Absolute path' }), {
      target: { value: '/work/new-project' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add project' }))
    await screen.findByText('new-project')
    expect(trigger).toHaveTextContent('new-project')
  })

  it('removes a Project through an inline confirmation', async () => {
    render(<ProjectSelectHarness />)
    fireEvent.click(screen.getByRole('button', { name: 'Active project' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Manage projects…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove mission-control' }))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    })

    await vi.waitFor(() =>
      expect(screen.queryByText('/work/mission-control')).not.toBeInTheDocument(),
    )
  })
})
