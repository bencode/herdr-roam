import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { vi } from 'vitest'
import type { ProjectSection } from '../../../workbench/resource'
import { ProjectPanel } from '.'

const sessionFixtures = Array.from({ length: 14 }, (_, index) => ({
  id: `session-${index + 1}`,
  provider: index % 2 === 0 ? ('codex' as const) : ('claude' as const),
  title: index === 4 ? 'Provider capability parity matrix' : `Session ${index + 1}`,
  cwd: '/work/herdr-roam',
  createdAt: '2026-08-31T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
}))

vi.mock('../../../features/session/client', () => ({
  fetchProjectSessions: vi.fn((projectName: string, options?: { readonly query?: string }) => {
    const projectItems = projectName === 'herdr-roam' ? sessionFixtures : []
    const query = options?.query?.trim().toLowerCase() ?? ''
    const items = query
      ? projectItems.filter(session => session.title.toLowerCase().includes(query))
      : projectItems
    return Promise.resolve({ items, total: items.length, nextCursor: null })
  }),
  SessionClientError: class SessionClientError extends Error {},
}))

vi.mock('../../../features/agent/runtime-provider', () => ({
  useAgentRuntime: () => ({
    snapshot: {
      source: { state: 'connected' as const, version: '0.8.2', protocol: 20 },
      stale: false,
      items: [],
    },
  }),
}))

const ProjectPanelHarness = ({ projectName = 'herdr-roam' }: { readonly projectName?: string }) => {
  const [section, setSection] = useState<ProjectSection>('sessions')
  return (
    <ProjectPanel
      activeProjectName={projectName}
      section={section}
      onSection={setSection}
      onOpen={() => undefined}
    />
  )
}

const selectResource = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

describe('ProjectPanel', () => {
  it('uses one project resource browser and filters dense Session fixtures', async () => {
    render(<ProjectPanelHarness />)

    expect(screen.getByRole('button', { name: 'Sessions' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('combobox', { name: 'Project resource' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Sessions browser' })).toBeVisible()
    expect(await screen.findByText('14')).toBeVisible()

    fireEvent.change(screen.getByRole('textbox', { name: 'Search sessions' }), {
      target: { value: 'parity' },
    })
    expect(await screen.findByText('Provider capability parity matrix')).toBeVisible()
  })

  it('switches project browsers with one-click resource tabs and resets search', async () => {
    render(<ProjectPanelHarness />)

    await screen.findByText('14')

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
