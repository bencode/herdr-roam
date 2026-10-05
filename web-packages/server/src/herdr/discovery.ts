import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { HERDR_PROTOCOL } from '../config.js'
import { herdrStatusSchema } from './schema.js'

const execFileAsync = promisify(execFile)

type StatusReader = () => Promise<string>

const readStatus: StatusReader = async () => {
  const result = await execFileAsync('herdr', ['status', 'server', '--json'], {
    encoding: 'utf8',
    timeout: 5_000,
  })
  return result.stdout
}

export type HerdrDiscovery = {
  readonly socketPath: string
  readonly version: string
  readonly protocol: number
}

export type DiscoveryErrorCode =
  | 'herdr_missing'
  | 'herdr_not_running'
  | 'protocol_incompatible'
  | 'herdr_unavailable'

export class HerdrDiscoveryError extends Error {
  readonly code: DiscoveryErrorCode

  constructor(code: DiscoveryErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'HerdrDiscoveryError'
    this.code = code
  }
}

const errnoCode = (error: unknown): string | null => {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null
  return typeof error.code === 'string' ? error.code : null
}

export const discoverHerdr = async (statusReader: StatusReader = readStatus): Promise<HerdrDiscovery> => {
  let stdout: string
  try {
    stdout = await statusReader()
  } catch (error) {
    if (errnoCode(error) === 'ENOENT') {
      throw new HerdrDiscoveryError('herdr_missing', 'Herdr is not installed or is not on PATH.', {
        cause: error,
      })
    }
    throw new HerdrDiscoveryError(
      'herdr_unavailable',
      'Herdr status could not be read.',
      { cause: error },
    )
  }

  let raw: unknown
  try {
    raw = JSON.parse(stdout)
  } catch (error) {
    throw new HerdrDiscoveryError('herdr_unavailable', 'Herdr returned invalid status JSON.', {
      cause: error,
    })
  }
  const parsed = herdrStatusSchema.safeParse(raw)
  if (!parsed.success) {
    throw new HerdrDiscoveryError('herdr_unavailable', 'Herdr returned an invalid status response.', {
      cause: parsed.error,
    })
  }
  if (!parsed.data.running || !parsed.data.socket) {
    throw new HerdrDiscoveryError('herdr_not_running', 'The default Herdr server is not running.')
  }
  if (!parsed.data.compatible || parsed.data.protocol !== HERDR_PROTOCOL) {
    throw new HerdrDiscoveryError(
      'protocol_incompatible',
      `Herdr protocol ${parsed.data.protocol} is incompatible with protocol ${HERDR_PROTOCOL}.`,
    )
  }
  return {
    socketPath: parsed.data.socket,
    version: parsed.data.version,
    protocol: parsed.data.protocol,
  }
}
