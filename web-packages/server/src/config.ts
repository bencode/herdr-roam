import { homedir, platform } from 'node:os'
import { join } from 'node:path'

export const HERDR_PROTOCOL = 20
export const HERDR_REQUEST_TIMEOUT_MS = 5_000
export const HERDR_MAX_MESSAGE_BYTES = 4 * 1024 * 1024
export const SSE_HEARTBEAT_MS = 15_000
export const AGENT_REFRESH_MS = 2_000
export const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000] as const

export const serverConfig = {
  host: process.env.ROAM_HOST ?? '127.0.0.1',
  port: Number(process.env.ROAM_PORT ?? 4310),
} as const

const applicationConfigDirectory = (): string => {
  if (platform() === 'darwin') return join(homedir(), 'Library', 'Application Support')
  if (platform() === 'win32') return process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming')
  return process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config')
}

export const projectConfigPath = join(applicationConfigDirectory(), 'herdr-roam', 'config.json')
