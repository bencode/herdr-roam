import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { CompareApiError, CompareBranch, CompareFile } from '@herdr-roam/shared'

const execFileAsync = promisify(execFile)
type ErrorCode = CompareApiError['error']['code']

export class CompareError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'CompareError'
  }
}

export const runGit = async (
  cwd: string,
  args: readonly string[],
  signal?: AbortSignal,
  allowedExit?: number,
): Promise<Buffer | null> => {
  try {
    const { stdout } = await execFileAsync('git', ['--literal-pathspecs', '-C', cwd, ...args], {
      encoding: 'buffer',
      timeout: 10_000,
      maxBuffer: 8 * 1024 * 1024,
      signal,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    })
    return stdout
  } catch (error) {
    if (signal?.aborted) throw error
    if (error instanceof Error && 'code' in error) {
      if (allowedExit !== undefined && error.code === allowedExit) return null
      if (error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
        throw new CompareError(
          'comparison_too_large',
          'This comparison exceeds the output limit.',
          { cause: error },
        )
      }
      if ('killed' in error && error.killed) {
        throw new CompareError(
          'git_timeout',
          'Git took too long. Try comparing a smaller branch.',
          { cause: error },
        )
      }
    }
    throw error
  }
}

export const gitText = async (
  cwd: string,
  args: readonly string[],
  signal?: AbortSignal,
  allowedExit?: number,
): Promise<string | null> =>
  (await runGit(cwd, args, signal, allowedExit))?.toString('utf8') ?? null

export const branchesOf = async (
  cwd: string,
  signal?: AbortSignal,
): Promise<readonly CompareBranch[]> => {
  const output = await gitText(
    cwd,
    [
      'for-each-ref',
      '--format=%(refname)%00%(objectname)%00%(symref)',
      'refs/heads/',
      'refs/remotes/',
    ],
    signal,
  )
  return (output ?? '')
    .split('\n')
    .filter(Boolean)
    .flatMap(line => {
      const [ref, oid, symref] = line.split('\0')
      return ref && oid && !symref
        ? [{ ref, oid, name: ref.replace(/^refs\/(heads|remotes)\//, '') }]
        : []
    })
}

const diffArgs = (baseOid: string, sourceOid: string) => [
  'diff',
  '--no-ext-diff',
  '--no-textconv',
  '--no-color',
  '--no-relative',
  '--find-renames=50%',
  '--ignore-submodules=none',
  baseOid,
  sourceOid,
]

const statusOf = (status: string): CompareFile['status'] => {
  if (status.startsWith('A')) return 'added'
  if (status.startsWith('D')) return 'deleted'
  if (status.startsWith('R')) return 'renamed'
  if (status.startsWith('T')) return 'type-changed'
  return 'modified'
}

const parseRaw = (output: string): readonly Omit<CompareFile, 'added' | 'removed'>[] => {
  if (output && !output.endsWith('\0')) throw new Error('Incomplete Git raw diff output.')
  const fields = output.split('\0')
  const entries: Omit<CompareFile, 'added' | 'removed'>[] = []
  let index = 0
  while (index < fields.length - 1) {
    const header = fields[index++]?.match(
      /^:([0-7]{6}) ([0-7]{6}) [a-f0-9]+ [a-f0-9]+ ([ADMRT][0-9]*)$/,
    )
    if (!header) throw new Error('Invalid Git raw diff record.')
    const status = statusOf(header[3] ?? '')
    const path = fields[index++]
    const next = status === 'renamed' ? fields[index++] : path
    if (!path || !next) throw new Error('Missing Git raw diff path.')
    entries.push({
      status,
      oldPath: status === 'added' ? null : path,
      newPath: status === 'deleted' ? null : next,
      oldMode: header[1] === '000000' ? null : (header[1] ?? null),
      newMode: header[2] === '000000' ? null : (header[2] ?? null),
    })
  }
  return entries
}

const parseStats = (
  output: string,
): ReadonlyMap<string, Pick<CompareFile, 'added' | 'removed'>> => {
  const fields = output.split('\0')
  const stats = new Map<string, Pick<CompareFile, 'added' | 'removed'>>()
  let index = 0
  while (index < fields.length - 1) {
    const field = fields[index++] ?? ''
    const first = field.indexOf('\t')
    const second = field.indexOf('\t', first + 1)
    const added = field.slice(0, first)
    const removed = field.slice(first + 1, second)
    let path = field.slice(second + 1)
    if (!path) {
      index += 1
      path = fields[index++] ?? ''
    }
    stats.set(path, {
      added: added === '-' ? null : Number(added),
      removed: removed === '-' ? null : Number(removed),
    })
  }
  return stats
}

export const changedFiles = async (
  cwd: string,
  baseOid: string,
  sourceOid: string,
  signal?: AbortSignal,
): Promise<readonly CompareFile[]> => {
  const args = diffArgs(baseOid, sourceOid)
  const [raw, numbers] = await Promise.all([
    gitText(cwd, [...args, '--raw', '-z', '--'], signal),
    gitText(cwd, [...args, '--numstat', '-z', '--'], signal),
  ])
  const stats = parseStats(numbers ?? '')
  return parseRaw(raw ?? '').map(entry => ({
    ...entry,
    ...(stats.get(entry.newPath ?? entry.oldPath ?? '') ?? { added: null, removed: null }),
  }))
}

export const verifyCommit = async (
  cwd: string,
  oid: string,
  signal?: AbortSignal,
): Promise<void> => {
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(oid))
    throw new CompareError('invalid_query', 'A full commit OID is required.')
  const kind = await gitText(cwd, ['cat-file', '-t', oid], signal, 128)
  if (kind?.trim() !== 'commit')
    throw new CompareError('ref_not_found', 'The compared commit is no longer available.')
}
