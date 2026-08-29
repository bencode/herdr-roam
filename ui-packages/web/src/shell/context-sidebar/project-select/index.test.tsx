import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { projects } from '../../../mock/data'
import { ProjectSelect } from '.'

const ProjectSelectHarness = () => {
  const [value, setValue] = useState('herdr-roam')
  return <ProjectSelect projects={projects} value={value} onValueChange={setValue} />
}

describe('ProjectSelect', () => {
  it('changes the active project with an accessible popup', async () => {
    render(<ProjectSelectHarness />)

    const trigger = screen.getByRole('combobox', { name: 'Active project' })
    expect(trigger).toHaveTextContent('herdr-roam')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('option', { name: 'cc-mission-control' }))

    expect(trigger).toHaveTextContent('cc-mission-control')
  })
})
