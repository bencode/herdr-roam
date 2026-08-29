import { fireEvent, render, screen } from '@testing-library/react'
import { ProjectPanel } from '.'

const ProjectPanelHarness = ({ projectName = 'herdr-roam' }: { readonly projectName?: string }) => (
  <ProjectPanel activeProjectName={projectName} onOpen={() => undefined} />
)

const selectResource = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

describe('ProjectPanel', () => {
  it('uses one project resource browser and filters dense Session fixtures', () => {
    render(<ProjectPanelHarness />)

    expect(screen.getByRole('button', { name: 'Sessions' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('combobox', { name: 'Project resource' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Sessions browser' })).toBeVisible()
    expect(screen.getByText('14')).toBeVisible()

    fireEvent.change(screen.getByRole('textbox', { name: 'Search sessions' }), {
      target: { value: 'parity' },
    })
    expect(screen.getByText('Provider capability parity matrix')).toBeVisible()
    expect(screen.getByText('1/14')).toBeVisible()
  })

  it('switches project browsers with one-click resource tabs and resets search', () => {
    render(<ProjectPanelHarness />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Search sessions' }), {
      target: { value: 'parity' },
    })
    selectResource('Issues')
    expect(screen.getByRole('textbox', { name: 'Search issues' })).toHaveValue('')
    expect(screen.getByText('Clarify runtime ownership')).toBeVisible()

    selectResource('Loops')
    expect(screen.getByText('Dependency release review')).toBeVisible()

    selectResource('Files')
    expect(screen.getByRole('button', { name: 'docs' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'vision-and-scope.md' })).toBeVisible()
  })

  it('shows sparse project states without hiding the resource structure', () => {
    render(<ProjectPanelHarness projectName="cc-mission-control" />)

    selectResource('Issues')
    expect(screen.getByText('Issue store not configured')).toBeVisible()

    selectResource('Loops')
    expect(screen.getByText('No Loops yet')).toBeVisible()
  })
})
