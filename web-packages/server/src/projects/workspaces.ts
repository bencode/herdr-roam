import { createHash } from 'node:crypto'
import { basename, isAbsolute, relative, resolve } from 'node:path'
import type { Project, ProjectWorkspace } from '@herdr-roam/shared'
import { existingDirectory, gitLocation, GitInspectionError, gitWorktrees } from './git.js'

export type ProjectWorkspaceErrorCode =
  | 'project_directory_unavailable'
  | 'workspace_not_found'
  | 'workspace_directory_unavailable'
  | 'workspace_unavailable'

export class ProjectWorkspaceError extends Error {
  readonly code: ProjectWorkspaceErrorCode

  constructor(code: ProjectWorkspaceErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ProjectWorkspaceError'
    this.code = code
  }
}

const workspaceId = (path: string, primary: boolean): string =>
  primary ? 'primary' : createHash('sha256').update(path).digest('base64url')

export const projectIdentity = async (path: string): Promise<string> => {
  const git = await gitLocation(path)
  return git ? `git:${git.commonDirectory}` : `directory:${path}`
}

const directoryWorkspace = (path: string): ProjectWorkspace => ({
  id: 'primary',
  name: basename(path) || path,
  path,
  kind: 'directory',
  branch: null,
  primary: true,
})

export const listProjectWorkspaces = async (
  project: Project,
): Promise<readonly ProjectWorkspace[]> => {
  const primaryPath = await existingDirectory(project.path)
  if (!primaryPath) {
    throw new ProjectWorkspaceError(
      'project_directory_unavailable',
      `Project directory ${project.path} is unavailable.`,
    )
  }
  let worktrees: Awaited<ReturnType<typeof gitWorktrees>>
  try {
    worktrees = await gitWorktrees(primaryPath)
  } catch (error) {
    if (error instanceof GitInspectionError) {
      throw new ProjectWorkspaceError('workspace_unavailable', error.message, { cause: error })
    }
    throw error
  }
  if (!worktrees) return [directoryWorkspace(primaryPath)]

  const available = await Promise.all(
    worktrees.map(async (worktree): Promise<ProjectWorkspace | null> => {
      const path = await existingDirectory(worktree.path)
      if (!path) return null
      const primary = path === primaryPath
      return {
        id: workspaceId(path, primary),
        name: basename(path) || path,
        path,
        kind: 'worktree' as const,
        branch: worktree.branch,
        primary,
      }
    }),
  )
  return available
    .filter((workspace): workspace is ProjectWorkspace => workspace !== null)
    .toSorted(
      (left, right) =>
        Number(right.primary) - Number(left.primary) || left.path.localeCompare(right.path),
    )
}

export const resolveProjectWorkspace = async (
  project: Project,
  id: string,
): Promise<ProjectWorkspace> => {
  const workspaces = await listProjectWorkspaces(project)
  const workspace = workspaces.find(candidate => candidate.id === id)
  if (!workspace) {
    throw new ProjectWorkspaceError('workspace_not_found', `Workspace ${id} was not found.`)
  }
  if (!(await existingDirectory(workspace.path))) {
    throw new ProjectWorkspaceError(
      'workspace_directory_unavailable',
      `Workspace directory ${workspace.path} is unavailable.`,
    )
  }
  return workspace
}

export const directoryBelongsToWorkspaces = (
  workspaces: readonly ProjectWorkspace[],
  cwd: string,
): boolean => {
  if (!isAbsolute(cwd)) return false
  return workspaces.some(workspace => {
    const relation = relative(resolve(workspace.path), resolve(cwd))
    return relation === '' || (!relation.startsWith('..') && !isAbsolute(relation))
  })
}
