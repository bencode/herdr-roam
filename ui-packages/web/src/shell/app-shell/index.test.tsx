import { fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAssistantStore } from '../../features/assistant/store'
import { AppShell } from '.'

type PanelHandle = {
  collapse: () => void
  expand: () => void
  resize: (width: number) => void
  isCollapsed: () => boolean
}

vi.mock('react-resizable-panels', async () => {
  const { useRef } = await import('react')
  return {
    usePanelRef: () => useRef<PanelHandle | null>(null),
    useDefaultLayout: () => ({ defaultLayout: undefined, onLayoutChanged: vi.fn() }),
    Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Separator: () => null,
    Panel: ({
      id,
      panelRef,
      onResize,
      children,
    }: {
      id: string
      panelRef: { current: PanelHandle | null }
      onResize?: (size: { inPixels: number }) => void
      children: ReactNode
    }) => {
      const collapsed = useRef(id === 'assistant')
      panelRef.current = {
        isCollapsed: () => collapsed.current,
        collapse: () => {
          collapsed.current = true
          onResize?.({ inPixels: id === 'context-sidebar' ? 44 : 0 })
        },
        resize: width => {
          collapsed.current = false
          onResize?.({ inPixels: width })
        },
        expand: () => {
          collapsed.current = false
          onResize?.({ inPixels: 560 })
        },
      }
      return <div>{children}</div>
    },
  }
})
vi.mock('../../features/agent/runtime-provider', () => ({
  useAgentRuntime: () => ({ snapshot: { items: [] }, transportError: null }),
}))
vi.mock('../../features/agent/blocked-notifications', () => ({ useBlockedNotifications: vi.fn() }))
vi.mock('../../features/assistant', () => ({
  AssistantPanel: () => <section aria-label="Assistant">Agent terminal</section>,
}))
vi.mock('../context-sidebar', () => ({ ContextSidebar: () => <div>Project files</div> }))
vi.mock('../context-sidebar/project-select', () => ({ ProjectSelect: () => <div>Project</div> }))
vi.mock('../runtime-status', () => ({ RuntimeStatus: () => null }))
vi.mock('../activity-bar', () => ({
  ActivityBar: ({ onChange }: { onChange: () => void }) => (
    <button type="button" onClick={onChange}>
      Projects
    </button>
  ),
}))
vi.mock('../tab-bar', () => ({
  TabBar: ({ trailing }: { trailing: ReactNode }) => <div>{trailing}</div>,
}))
vi.mock('../resource-host', async () => {
  const { useContext } = await import('react')
  const { ReadingFocusContext } = await import('../../components/reader/reading-focus')
  return {
    ResourceHost: () => {
      const focus = useContext(ReadingFocusContext)
      return (
        <button type="button" onClick={focus?.toggle}>
          {focus?.focused ? 'Exit focus' : 'Enter focus'}
        </button>
      )
    },
  }
})

const props: ComponentProps<typeof AppShell> = {
  projects: [],
  activeProjectName: 'example',
  projectConfigPath: null,
  projectError: null,
  activeDimension: 'projects',
  activityPaths: { projects: '/', agents: '/agents', skills: '/skills' },
  projectSection: 'files',
  projectRouteKey: 'example',
  tabs: [],
  active: { type: 'file', projectName: 'example', workspaceId: 'primary', path: 'guide.md' },
  onProject: vi.fn(),
  onAddProject: vi.fn(),
  onRemoveProject: vi.fn(),
  onWorkbench: vi.fn(),
  onOpen: vi.fn(),
  onClose: vi.fn(),
  onCloseMany: vi.fn(),
}

beforeEach(() => {
  localStorage.clear()
  useAssistantStore.setState({ open: false, maximized: false, agentIds: [], activeAgentId: null })
})

describe('reading focus', () => {
  it('temporarily hides panels without persisting Agent or width changes and restores them on exit', () => {
    useAssistantStore.getState().openAgent('agent-1')
    render(<AppShell {...props} />)
    const savedAgent = localStorage.getItem('herdr-roam.assistant.v1')
    const savedWidth = localStorage.getItem('herdr-roam.assistant-width.v1')
    fireEvent.click(screen.getByRole('button', { name: 'Enter focus' }))
    expect(screen.getByTestId('sidebar-context')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('region', { name: 'Assistant' })).not.toBeInTheDocument()
    expect(localStorage.getItem('herdr-roam.assistant.v1')).toBe(savedAgent)
    expect(localStorage.getItem('herdr-roam.assistant-width.v1')).toBe(savedWidth)
    fireEvent.click(screen.getByRole('button', { name: 'Exit focus' }))
    expect(screen.getByTestId('sidebar-context')).not.toHaveAttribute('aria-hidden')
    expect(screen.getByRole('region', { name: 'Assistant' })).toBeVisible()
    expect(useAssistantStore.getState().activeAgentId).toBe('agent-1')
  })

  it('preserves a collapsed sidebar and exits focus when another resource or a panel is opened', () => {
    const view = render(<AppShell {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Enter focus' }))
    fireEvent.click(screen.getByRole('button', { name: 'Exit focus' }))
    expect(screen.getByTestId('sidebar-context')).toHaveAttribute('aria-hidden', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'Enter focus' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Assistant' }))
    expect(screen.getByRole('button', { name: 'Enter focus' })).toBeVisible()
    expect(screen.getByRole('region', { name: 'Assistant' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Enter focus' }))
    view.rerender(
      <AppShell
        {...props}
        active={{ type: 'file', projectName: 'example', workspaceId: 'primary', path: 'other.md' }}
      />,
    )
    expect(screen.getByRole('button', { name: 'Enter focus' })).toBeVisible()
  })
})
