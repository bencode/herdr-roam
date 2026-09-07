import { fireEvent, render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import type { ResourceRef } from '../../workbench/resource'
import { TabBar } from '.'

vi.mock('../../features/agent/runtime-provider', () => ({
  useAgentRuntime: () => ({
    snapshot: { items: [] },
    agentById: () => undefined,
  }),
}))

vi.mock('../../features/session/use-session-data', () => ({
  useSessionData: () => ({ value: null }),
}))

const session = {
  type: 'session',
  projectName: 'herdr-roam',
  provider: 'codex',
  sessionId: 'product-scan',
} as const
const file = {
  type: 'file',
  projectName: 'herdr-roam',
  workspaceId: 'primary',
  path: 'docs/product/vision-and-scope.md',
} as const
const skill = {
  type: 'skill',
  scope: 'project',
  projectName: 'herdr-roam',
  skillId: 'frontend-design',
} as const
const tabs: readonly ResourceRef[] = [session, file, skill]

describe('TabBar', () => {
  it('exposes contextual bulk-close actions for resource tabs', async () => {
    const onCloseMany = vi.fn<(resources: readonly ResourceRef[]) => void>()
    render(
      <TabBar
        tabs={tabs}
        active={session}
        onWorkbench={() => undefined}
        onActivate={() => undefined}
        onClose={() => undefined}
        onCloseMany={onCloseMany}
      />,
    )

    fireEvent.keyDown(screen.getByRole('tab', { name: 'product-scan' }), {
      key: 'F10',
      shiftKey: true,
    })

    expect(await screen.findByRole('menuitem', { name: 'Close' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Close Other Tabs' })).toBeVisible()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Close Tabs to the Right' }))
    expect(onCloseMany).toHaveBeenCalledWith([file, skill])
  })
})
