import { defaultWorkbenchSnapshot, useWorkbenchStore } from './store'

const session = { type: 'session', projectName: 'herdr-roam', sessionId: 'scan' } as const
const issue = { type: 'issue', projectName: 'other-project', issueId: 'hr-018' } as const

describe('workbench store', () => {
  beforeEach(() => {
    localStorage.clear()
    useWorkbenchStore.setState(defaultWorkbenchSnapshot)
  })

  it('deduplicates resources while preserving cross-project tabs', () => {
    useWorkbenchStore.getState().open(session)
    useWorkbenchStore.getState().open(issue)
    useWorkbenchStore.getState().open(session)
    expect(useWorkbenchStore.getState().tabs).toEqual([session, issue])
    expect(useWorkbenchStore.getState().lastActive).toEqual(session)
  })

  it('selects the right neighbor when closing the active tab', () => {
    useWorkbenchStore.getState().open(session)
    useWorkbenchStore.getState().open(issue)
    useWorkbenchStore.getState().open(session)
    expect(useWorkbenchStore.getState().close(session)).toEqual(issue)
    expect(useWorkbenchStore.getState().tabs).toEqual([issue])
  })

  it('persists only the versioned workbench snapshot', () => {
    useWorkbenchStore.getState().open(session)
    expect(JSON.parse(localStorage.getItem('herdr-roam.workbench.v2') ?? '')).toEqual({
      version: 2,
      activeProjectName: 'herdr-roam',
      tabs: [session],
      lastActive: session,
    })
  })
})
