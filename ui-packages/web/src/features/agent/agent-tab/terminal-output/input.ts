import {
  AGENT_TEXT_MAX_BYTES,
  type AgentInputKey,
  type AgentInputRequest,
} from '@herdr-roam/shared'
import {
  type CompositionEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
} from 'react'

const inputKeyByKeyboardKey: Readonly<Partial<Record<string, AgentInputKey>>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'enter',
  Escape: 'esc',
  Tab: 'tab',
  Backspace: 'backspace',
  Delete: 'delete',
  Home: 'home',
  End: 'end',
}

type TerminalKeyEvent = {
  readonly key: string
  readonly altKey: boolean
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly shiftKey: boolean
}

export const terminalInputKey = ({
  key,
  altKey,
  ctrlKey,
  metaKey,
  shiftKey,
}: TerminalKeyEvent): AgentInputKey | null => {
  if (altKey || ctrlKey || metaKey) return null
  if (key === 'Tab') return shiftKey ? 'shift+tab' : 'tab'
  if (shiftKey) return null
  return inputKeyByKeyboardKey[key] ?? null
}

export const useTerminalInputBridge = ({
  agentId,
  canInput,
  sendInput,
  onInputAccepted,
  onInputError,
}: {
  readonly agentId: string
  readonly canInput: boolean
  readonly sendInput: (agentId: string, request: AgentInputRequest) => Promise<unknown>
  readonly onInputAccepted: () => void
  readonly onInputError: (message: string | null) => void
}) => {
  const terminalRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const inputQueueRef = useRef<Promise<void>>(Promise.resolve())
  const composingRef = useRef(false)

  const queueInput = useCallback(
    (request: AgentInputRequest) => {
      if (!canInput) return
      if (
        request.type === 'text' &&
        new TextEncoder().encode(request.text).byteLength > AGENT_TEXT_MAX_BYTES
      ) {
        onInputError('Terminal input is too large (64 KB maximum).')
        return
      }
      onInputError(null)
      inputQueueRef.current = inputQueueRef.current.then(async () => {
        try {
          await sendInput(agentId, request)
          onInputError(null)
          onInputAccepted()
        } catch (inputFailure) {
          console.error('Agent terminal input failed', inputFailure)
          onInputError(
            inputFailure instanceof Error
              ? inputFailure.message
              : 'The Agent input could not be sent.',
          )
        }
      })
    },
    [agentId, canInput, onInputAccepted, onInputError, sendInput],
  )

  const activateInput = useCallback(() => {
    if (!canInput) return
    inputRef.current?.focus({ preventScroll: true })
  }, [canInput])

  const returnToTerminal = useCallback(() => {
    inputRef.current?.blur()
    terminalRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (!canInput) inputRef.current?.blur()
  }, [canInput])

  useEffect(() => {
    if (!canInput) return
    const blurOutsideTerminal = (event: PointerEvent) => {
      const input = inputRef.current
      if (!input || document.activeElement !== input) return
      if (event.target instanceof Node && terminalRef.current?.contains(event.target)) return
      input.blur()
    }
    document.addEventListener('pointerdown', blurOutsideTerminal)
    return () => document.removeEventListener('pointerdown', blurOutsideTerminal)
  }, [canInput])

  const handleTerminalKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (
        event.target !== event.currentTarget ||
        event.key !== 'Enter' ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return
      }
      event.preventDefault()
      activateInput()
    },
    [activateInput],
  )

  const handleTerminalMouseUp = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (!canInput) return
      const selection = window.getSelection()
      if (selection && !selection.isCollapsed) return
      if (event.target instanceof Element && event.target.closest('button')) return
      activateInput()
    },
    [activateInput, canInput],
  )

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (composingRef.current || event.nativeEvent.isComposing) return
      const key = terminalInputKey(event)
      if (!key) return
      event.preventDefault()
      queueInput({ type: 'keys', keys: [key] })
      if (key === 'esc') returnToTerminal()
    },
    [queueInput, returnToTerminal],
  )

  const submitText = useCallback(
    (input: HTMLTextAreaElement) => {
      const text = input.value
      input.value = ''
      if (text) queueInput({ type: 'text', text })
    },
    [queueInput],
  )

  const handleTextInput = useCallback(
    (event: FormEvent<HTMLTextAreaElement>) => {
      if (!composingRef.current) submitText(event.currentTarget)
    },
    [submitText],
  )

  const handleCompositionEnd = useCallback(
    (event: CompositionEvent<HTMLTextAreaElement>) => {
      composingRef.current = false
      submitText(event.currentTarget)
    },
    [submitText],
  )

  return {
    terminalRef,
    inputRef,
    queueInput,
    handleTerminalKeyDown,
    handleTerminalMouseUp,
    handleInputKeyDown,
    handleTextInput,
    handleCompositionEnd,
    handleCompositionStart: () => {
      composingRef.current = true
    },
  }
}
