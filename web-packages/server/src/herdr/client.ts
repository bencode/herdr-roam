import { randomUUID } from 'node:crypto'
import { createConnection, type Socket } from 'node:net'
import { HERDR_MAX_MESSAGE_BYTES, HERDR_REQUEST_TIMEOUT_MS } from '../config.js'
import {
  agentListResultSchema,
  agentPromptedResultSchema,
  errorResponseSchema,
  eventEnvelopeSchema,
  paneListResultSchema,
  paneReadResultSchema,
  subscriptionStartedSchema,
  successResponseSchema,
  type RawAgent,
  type RawPane,
} from './schema.js'

type Request = {
  readonly id: string
  readonly method: string
  readonly params: Readonly<Record<string, unknown>>
}

export type HerdrClient = {
  readonly listAgents: () => Promise<readonly RawAgent[]>
  readonly listPanes: () => Promise<readonly RawPane[]>
  readonly readAgent: (target: string) => Promise<string>
  readonly promptAgent: (target: string, text: string) => Promise<void>
  readonly subscribe: (
    onEvent: () => void,
    onDisconnect: (error: Error) => void,
  ) => Promise<() => void>
}

export class HerdrApiError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'HerdrApiError'
    this.code = code
  }
}

const jsonLine = (request: Request): string => `${JSON.stringify(request)}\n`

const asError = (error: unknown): Error =>
  error instanceof Error ? error : new Error('Unknown Herdr socket error', { cause: error })

const parseJson = (line: string): unknown => {
  try {
    return JSON.parse(line)
  } catch (error) {
    throw new Error('Herdr returned invalid JSON.', { cause: error })
  }
}

const responseResult = (line: string, requestId: string): unknown => {
  const raw = parseJson(line)
  const failure = errorResponseSchema.safeParse(raw)
  if (failure.success && failure.data.id === requestId) {
    throw new HerdrApiError(failure.data.error.code, failure.data.error.message)
  }
  const success = successResponseSchema.safeParse(raw)
  if (!success.success || success.data.id !== requestId) {
    throw new Error('Herdr returned an invalid response envelope.', {
      cause: success.success ? undefined : success.error,
    })
  }
  return success.data.result
}

const request = (
  socketPath: string,
  method: string,
  params: Readonly<Record<string, unknown>>,
): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const id = `roam:${randomUUID()}`
    const socket = createConnection(socketPath)
    let buffer = ''
    let settled = false

    const finish = (result: { readonly value?: unknown; readonly error?: Error }) => {
      if (settled) return
      settled = true
      socket.destroy()
      if (result.error) reject(result.error)
      else resolve(result.value)
    }

    socket.setTimeout(HERDR_REQUEST_TIMEOUT_MS)
    socket.once('connect', () => socket.write(jsonLine({ id, method, params })))
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8')
      if (Buffer.byteLength(buffer) > HERDR_MAX_MESSAGE_BYTES) {
        finish({ error: new Error('Herdr response exceeded the message size limit.') })
        return
      }
      const newline = buffer.indexOf('\n')
      if (newline < 0) return
      try {
        finish({ value: responseResult(buffer.slice(0, newline), id) })
      } catch (error) {
        finish({ error: asError(error) })
      }
    })
    socket.once('timeout', () => finish({ error: new Error('Herdr request timed out.') }))
    socket.once('error', error => finish({ error }))
    socket.once('close', () => {
      if (!settled) finish({ error: new Error('Herdr closed the socket before responding.') })
    })
  })

const subscriptions = [
  'pane.created',
  'pane.closed',
  'pane.updated',
  'pane.moved',
  'pane.exited',
  'pane.agent_detected',
] as const

const openSubscription = (
  socketPath: string,
  onEvent: () => void,
  onDisconnect: (error: Error) => void,
): Promise<() => void> =>
  new Promise((resolve, reject) => {
    const id = `roam:${randomUUID()}`
    const socket: Socket = createConnection(socketPath)
    let buffer = ''
    let started = false
    let closedIntentionally = false
    let failed = false

    const fail = (error: unknown) => {
      if (failed || closedIntentionally) return
      failed = true
      const normalized = asError(error)
      socket.destroy()
      if (started) onDisconnect(normalized)
      else reject(normalized)
    }

    const accept = (line: string) => {
      if (!started) {
        const result = responseResult(line, id)
        const parsed = subscriptionStartedSchema.safeParse(result)
        if (!parsed.success) throw new Error('Herdr rejected the event subscription.', { cause: parsed.error })
        started = true
        socket.setTimeout(0)
        resolve(() => {
          closedIntentionally = true
          socket.destroy()
        })
        return
      }
      const event = eventEnvelopeSchema.safeParse(parseJson(line))
      if (!event.success) throw new Error('Herdr returned an invalid event.', { cause: event.error })
      onEvent()
    }

    socket.setTimeout(HERDR_REQUEST_TIMEOUT_MS)
    socket.once('connect', () =>
      socket.write(
        jsonLine({
          id,
          method: 'events.subscribe',
          params: { subscriptions: subscriptions.map(type => ({ type })) },
        }),
      ),
    )
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8')
      if (Buffer.byteLength(buffer) > HERDR_MAX_MESSAGE_BYTES) {
        fail(new Error('Herdr event exceeded the message size limit.'))
        return
      }
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      try {
        lines.filter(Boolean).forEach(accept)
      } catch (error) {
        fail(error)
      }
    })
    socket.once('timeout', () => fail(new Error('Herdr subscription timed out.')))
    socket.once('error', fail)
    socket.once('close', () => {
      if (closedIntentionally || failed) return
      if (started) onDisconnect(new Error('Herdr event stream closed.'))
      else reject(new Error('Herdr closed the subscription socket.'))
    })
  })

export const createHerdrClient = (socketPath: string): HerdrClient => ({
  listAgents: async () => {
    const result = agentListResultSchema.parse(await request(socketPath, 'agent.list', {}))
    return result.agents
  },
  listPanes: async () => {
    const result = paneListResultSchema.parse(await request(socketPath, 'pane.list', {}))
    return result.panes
  },
  readAgent: async target => {
    const result = paneReadResultSchema.parse(
      await request(socketPath, 'agent.read', {
        target,
        source: 'recent_unwrapped',
        strip_ansi: false,
        format: 'ansi',
      }),
    )
    return result.read.text
  },
  promptAgent: async (target, text) => {
    agentPromptedResultSchema.parse(
      await request(socketPath, 'agent.prompt', {
        target,
        text,
      }),
    )
  },
  subscribe: (onEvent, onDisconnect) => openSubscription(socketPath, onEvent, onDisconnect),
})
