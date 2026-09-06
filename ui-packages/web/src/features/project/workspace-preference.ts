const STORAGE_KEY = 'herdr-roam.project-workspaces.v1'

type Preferences = Readonly<Record<string, string>>

const preferences = (): Preferences => {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return {}
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, string] =>
          entry[0] !== '' && typeof entry[1] === 'string' && entry[1] !== '',
      ),
    )
  } catch (error) {
    console.error('Project Workspace preference read failed', error)
    return {}
  }
}

export const readWorkspacePreference = (projectName: string): string =>
  preferences()[projectName] ?? 'primary'

export const writeWorkspacePreference = (projectName: string, workspaceId: string): void => {
  try {
    globalThis.localStorage?.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...preferences(), [projectName]: workspaceId }),
    )
  } catch (error) {
    console.error('Project Workspace preference write failed', error)
  }
}
