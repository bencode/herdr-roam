import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { App } from './app'
import { defaultWorkbenchSnapshot, useWorkbenchStore } from './workbench/store'

const selectProjectResource = (sidebar: ReturnType<typeof within>, resource: string) =>
  fireEvent.click(sidebar.getByRole('button', { name: resource }))

const CurrentPath = () => <output data-testid="current-path">{useLocation().pathname}</output>

describe('workbench application', () => {
  beforeEach(() => {
    localStorage.clear()
    useWorkbenchStore.setState(defaultWorkbenchSnapshot)
  })

  it('opens and deduplicates Session tabs from the project sidebar', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/herdr-roam']}>
        <App />
      </MemoryRouter>,
    )
    const sidebar = within(screen.getByTestId('context-sidebar'))
    fireEvent.click(sidebar.getByRole('button', { name: /Product scan/ }))
    await waitFor(() => expect(screen.getByRole('tab', { name: /Product scan/ })).toBeVisible())
    fireEvent.click(sidebar.getByRole('button', { name: /Product scan/ }))
    expect(screen.getAllByRole('tab', { name: /Product scan/ })).toHaveLength(1)
    fireEvent.keyDown(screen.getByRole('tab', { name: /Product scan/ }), { key: 'ArrowLeft' })
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Workbench' })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
  })

  it('preserves a File tab mode while switching resources', async () => {
    render(
      <MemoryRouter
        initialEntries={['/projects/herdr-roam/files/docs/product/vision-and-scope.md']}
      >
        <App />
      </MemoryRouter>,
    )
    const source = await screen.findByRole('button', { name: 'source' })
    fireEvent.click(source)
    const sidebar = within(screen.getByTestId('context-sidebar'))
    selectProjectResource(sidebar, 'Sessions')
    fireEvent.click(sidebar.getByRole('button', { name: /Product scan/ }))
    fireEvent.click(screen.getByRole('tab', { name: /vision-and-scope.md/ }))
    expect(screen.getByRole('button', { name: 'source' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('preserves a Session draft with Activity and omits unavailable actions', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/herdr-roam/sessions/product-scan']}>
        <App />
      </MemoryRouter>,
    )

    const prompt = await screen.findByRole('textbox', { name: /Continue this Session/ })
    fireEvent.change(prompt, { target: { value: 'Keep this draft' } })
    const sidebar = within(screen.getByTestId('context-sidebar'))
    selectProjectResource(sidebar, 'Files')
    fireEvent.click(sidebar.getByRole('button', { name: 'vision-and-scope.md' }))
    fireEvent.click(screen.getByRole('tab', { name: /Product scan/ }))

    expect(screen.getByRole('textbox', { name: /Continue this Session/ })).toHaveValue(
      'Keep this draft',
    )
    expect(screen.queryByRole('button', { name: 'Search' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tab actions' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Inspector' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Attach/ })).not.toBeInTheDocument()
  })

  it('opens Issue, File, and Skill resources in the same tablist', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/herdr-roam']}>
        <App />
      </MemoryRouter>,
    )
    const sidebar = within(screen.getByTestId('context-sidebar'))
    selectProjectResource(sidebar, 'Issues')
    fireEvent.click(sidebar.getByRole('button', { name: /Clarify runtime ownership/ }))
    selectProjectResource(sidebar, 'Files')
    fireEvent.click(sidebar.getByRole('button', { name: 'vision-and-scope.md' }))
    fireEvent.click(screen.getByRole('button', { name: 'Skills' }))
    fireEvent.click(sidebar.getByRole('button', { name: /herdr-roam-issues/ }))
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'HR-018' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /vision-and-scope.md/ })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /herdr-roam-issues/ })).toBeInTheDocument()
    })
  })

  it('preserves project browser state while switching global activities', () => {
    render(
      <MemoryRouter initialEntries={['/projects/herdr-roam']}>
        <App />
      </MemoryRouter>,
    )
    const sidebar = within(screen.getByTestId('context-sidebar'))
    selectProjectResource(sidebar, 'Issues')
    fireEvent.change(sidebar.getByRole('textbox', { name: 'Search issues' }), {
      target: { value: 'runtime' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Agents' }))
    expect(sidebar.getByRole('textbox', { name: 'Search agents' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Projects' }))

    expect(sidebar.getByRole('button', { name: 'Issues' })).toHaveAttribute('aria-pressed', 'true')
    expect(sidebar.getByRole('textbox', { name: 'Search issues' })).toHaveValue('runtime')
  })

  it('collapses to the Activity rail and expands from a global activity without losing state', () => {
    render(
      <MemoryRouter initialEntries={['/projects/herdr-roam']}>
        <App />
      </MemoryRouter>,
    )
    const sidebar = within(screen.getByTestId('context-sidebar'))
    expect(sidebar.getByRole('img', { name: 'Roam' })).toBeVisible()
    expect(sidebar.getByRole('combobox', { name: 'Active project' })).toBeVisible()

    selectProjectResource(sidebar, 'Issues')
    fireEvent.change(sidebar.getByRole('textbox', { name: 'Search issues' }), {
      target: { value: 'runtime' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))

    expect(sidebar.getByTestId('sidebar-context')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('button', { name: 'Collapse sidebar' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()

    fireEvent.click(sidebar.getByRole('button', { name: 'Agents' }))
    expect(sidebar.getByRole('textbox', { name: 'Search agents' })).toBeVisible()
    fireEvent.click(sidebar.getByRole('button', { name: 'Projects' }))
    expect(sidebar.getByRole('button', { name: 'Issues' })).toHaveAttribute('aria-pressed', 'true')
    expect(sidebar.getByRole('textbox', { name: 'Search issues' })).toHaveValue('runtime')
  })

  it('keeps the Active Project while opening a resource owned by another project', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/cc-mission-control/sessions/mission-review']}>
        <App />
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Mission board review/ })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
    expect(screen.getByRole('combobox', { name: 'Active project' })).toHaveTextContent('herdr-roam')
  })

  it('opens Runtime as a transient route-backed tab and returns to the previous resource', async () => {
    render(
      <MemoryRouter initialEntries={['/projects/herdr-roam/sessions/product-scan']}>
        <App />
        <CurrentPath />
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /Product scan/ })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Herdr connected — Open Runtime settings' }))

    expect(await screen.findByRole('heading', { name: 'Runtime' })).toBeVisible()
    expect(screen.getByTestId('current-path')).toHaveTextContent('/settings/runtime')
    expect(screen.getByRole('tab', { name: 'Runtime' })).toHaveAttribute('aria-selected', 'true')
    expect(useWorkbenchStore.getState().tabs).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Close Runtime' }))
    await waitFor(() =>
      expect(screen.getByTestId('current-path')).toHaveTextContent(
        '/projects/herdr-roam/sessions/product-scan',
      ),
    )
    expect(screen.getByRole('tab', { name: /Product scan/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })
})
