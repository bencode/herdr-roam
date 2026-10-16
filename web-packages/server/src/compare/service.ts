import type {
  CommittedText,
  CompareBranches,
  CompareFileView,
  Comparison,
  Project,
} from '@herdr-roam/shared'
import { PROJECT_TEXT_MAX_BYTES } from '../files/content.js'
import { gitLocation } from '../projects/git.js'
import { branchesOf, CompareError, changedFiles, gitText, runGit, verifyCommit } from './git.js'

const repository = async (project: Project): Promise<string> => {
  const location = await gitLocation(project.path)
  if (!location)
    throw new CompareError(
      'repository_unavailable',
      'This Project does not have an available Git repository.',
    )
  return location.topLevel
}

export const listCompareBranches = async (
  project: Project,
  signal?: AbortSignal,
): Promise<CompareBranches> => {
  const cwd = await repository(project)
  const items = await branchesOf(cwd, signal)
  const symbolic = (
    await gitText(cwd, ['symbolic-ref', '-q', 'refs/remotes/origin/HEAD'], signal, 1)
  )?.trim()
  const defaultTargetRef =
    [symbolic, 'refs/heads/main', 'refs/heads/master'].find(ref =>
      items.some(item => item.ref === ref),
    ) ?? null
  return { items, defaultTargetRef }
}

export const createComparison = async (
  project: Project,
  sourceRef: string,
  targetRef: string,
  signal?: AbortSignal,
): Promise<Comparison> => {
  const cwd = await repository(project)
  const branches = await branchesOf(cwd, signal)
  const source = branches.find(branch => branch.ref === sourceRef)
  const target = branches.find(branch => branch.ref === targetRef)
  if (!source || !target)
    throw new CompareError(
      'ref_not_found',
      'A selected branch is unavailable. Choose the branches again.',
    )
  const baseOid = (await gitText(cwd, ['merge-base', target.oid, source.oid], signal, 1))?.trim()
  if (!baseOid) throw new CompareError('no_merge_base', 'These branches have no common ancestor.')
  return { source, target, baseOid, files: await changedFiles(cwd, baseOid, source.oid, signal) }
}

type BlobResult = CommittedText | 'binary' | 'oversized' | 'submodule' | null

const readBlob = async (
  cwd: string,
  oid: string,
  path: string | null,
  signal?: AbortSignal,
): Promise<BlobResult> => {
  if (path === null) return null
  const record = await gitText(cwd, ['ls-tree', '-z', '-l', '--full-tree', oid, '--', path], signal)
  const tab = record?.indexOf('\t') ?? -1
  if (!record || tab < 0 || record.slice(tab + 1, -1) !== path) {
    throw new CompareError('file_not_found', 'The committed file is unavailable.')
  }
  const [mode, , blobOid, size] = record.slice(0, tab).trim().split(/\s+/)
  if (mode === '160000') return 'submodule'
  if (Number(size) > PROJECT_TEXT_MAX_BYTES) return 'oversized'
  const bytes = await runGit(cwd, ['cat-file', 'blob', blobOid ?? ''], signal)
  if (!bytes || bytes.includes(0)) return 'binary'
  try {
    return {
      path,
      content: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes),
    }
  } catch (error) {
    if (error instanceof TypeError) return 'binary'
    throw error
  }
}

export const readComparisonFile = async (
  project: Project,
  baseOid: string,
  sourceOid: string,
  path: string,
  signal?: AbortSignal,
): Promise<CompareFileView> => {
  if (
    !path ||
    path.includes('\0') ||
    path.startsWith('/') ||
    path.split('/').some(part => part === '..')
  ) {
    throw new CompareError('invalid_query', 'A repository-relative changed file path is required.')
  }
  const cwd = await repository(project)
  await Promise.all([verifyCommit(cwd, baseOid, signal), verifyCommit(cwd, sourceOid, signal)])
  const entry = (await changedFiles(cwd, baseOid, sourceOid, signal)).find(
    file => (file.newPath ?? file.oldPath) === path,
  )
  if (!entry) throw new CompareError('file_not_found', 'This file is not part of the comparison.')
  const [oldFile, newFile] = await Promise.all([
    readBlob(cwd, baseOid, entry.oldPath, signal),
    readBlob(cwd, sourceOid, entry.newPath, signal),
  ])
  const reason = [oldFile, newFile].find(
    (value): value is 'binary' | 'oversized' | 'submodule' => typeof value === 'string',
  )
  if (reason) return { kind: 'unavailable', entry, reason }
  if (typeof oldFile === 'string' || typeof newFile === 'string')
    throw new Error('Unexpected blob result.')
  return { kind: 'text', entry, oldFile, newFile }
}
