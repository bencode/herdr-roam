export const TERMINAL_INPUT_MAX_BYTES = 64 * 1024
export const TERMINAL_FRAME_MAX_BYTES = 4 * 1024 * 1024

export type TerminalMode = 'control' | 'observe'
export type TerminalConnection = {
  readonly mode: TerminalMode
  readonly cols: number
  readonly rows: number
  readonly takeover: boolean
}
export type TerminalCommand =
  | { readonly type: 'terminal.input'; readonly bytes: string }
  | { readonly type: 'terminal.resize'; readonly cols: number; readonly rows: number }
  | {
      readonly type: 'terminal.scroll'
      readonly direction: 'up' | 'down'
      readonly lines: number
      readonly source: 'wheel' | 'page_key'
    }
  | { readonly type: 'terminal.release' }
  | { readonly type: 'terminal.ack'; readonly seq: number }

export type TerminalFrame = {
  readonly type: 'terminal.frame'
  readonly seq: number
  readonly encoding: 'ansi'
  readonly width: number
  readonly height: number
  readonly full: boolean
  readonly bytes: string
}
export type TerminalErrorCode = 'busy' | 'taken_over' | 'unavailable' | 'protocol_error'
export type TerminalEvent =
  | TerminalFrame
  | { readonly type: 'terminal.closed'; readonly reason: string | null }
  | { readonly type: 'terminal.error'; readonly code: TerminalErrorCode; readonly message: string }
