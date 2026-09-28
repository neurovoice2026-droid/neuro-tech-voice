// Keeps the test call's AudioContext playing through device interruptions.
//
// iOS Safari suspends the context (state 'interrupted', or 'suspended' on
// older versions) when a phone call or Siri takes the audio session, when the
// screen locks, or when the tab goes to the background. It doesn't always
// resume on its own, and resume() outside a tap can stay pending forever.
// This watches the context and the page's visibility, tries to resume, and
// reports when it needs a tap ("Tap to resume audio"). Client-only, pure
// enough to test with a fake context and document.

/** The parts of an AudioContext this needs (a fake one in tests). */
export interface ResumableContext {
  /** 'running' | 'suspended' | 'closed', plus Safari's 'interrupted'. */
  readonly state: string
  resume(): Promise<void>
  addEventListener(type: 'statechange', listener: () => void): void
  removeEventListener(type: 'statechange', listener: () => void): void
}

export interface VisibilitySource {
  readonly visibilityState: string
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

export interface AudioResumeOptions {
  /** True while a call is live; nothing is done otherwise. */
  isActive(): boolean
  /** Called with true when audio stopped and only a tap can restart it, false once it plays again. */
  onBlockedChange(blocked: boolean): void
  /** How long an automatic resume() may take before asking for a tap. */
  resumeTimeoutMs?: number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (timer: unknown) => void
}

/** Starts watching; returns the function that stops it. */
export function watchAudioInterruptions(context: ResumableContext, page: VisibilitySource | null, options: AudioResumeOptions): () => void {
  const setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer as ReturnType<typeof setTimeout>))
  const timeoutMs = options.resumeTimeoutMs ?? 1_000
  let blocked = false
  let pending: unknown = null
  let stopped = false

  const setBlocked = (value: boolean) => {
    if (blocked === value) return
    blocked = value
    options.onBlockedChange(value)
  }

  const tryResume = () => {
    if (stopped || !options.isActive() || context.state === 'closed') return
    if (context.state === 'running') {
      setBlocked(false)
      return
    }
    // A hidden page can't resume on iOS; try again once it's visible.
    if (page && page.visibilityState === 'hidden') return
    if (pending !== null) return
    pending = setTimer(() => {
      pending = null
      if (!stopped && options.isActive() && context.state !== 'running' && context.state !== 'closed') setBlocked(true)
    }, timeoutMs)
    context.resume().then(
      () => {
        if (context.state === 'running') {
          if (pending !== null) clearTimer(pending)
          pending = null
          setBlocked(false)
        }
      },
      () => {
        if (pending !== null) clearTimer(pending)
        pending = null
        if (!stopped && options.isActive() && context.state !== 'closed') setBlocked(true)
      }
    )
  }

  const onStateChange = () => {
    if (context.state === 'running') {
      if (pending !== null) clearTimer(pending)
      pending = null
      setBlocked(false)
      return
    }
    tryResume()
  }
  const onVisibility = () => {
    if (page?.visibilityState === 'visible') tryResume()
  }

  context.addEventListener('statechange', onStateChange)
  page?.addEventListener('visibilitychange', onVisibility)
  return () => {
    stopped = true
    if (pending !== null) clearTimer(pending)
    pending = null
    context.removeEventListener('statechange', onStateChange)
    page?.removeEventListener('visibilitychange', onVisibility)
  }
}

/** For the "Tap to resume audio" button: resume() inside the tap, which iOS allows. */
export async function resumeFromTap(context: ResumableContext): Promise<boolean> {
  if (context.state === 'closed') return false
  try {
    await context.resume()
  } catch {
    return false
  }
  return context.state === 'running'
}
