import { describe, expect, it } from 'vitest'
import { resumeFromTap, watchAudioInterruptions, type ResumableContext, type VisibilitySource } from './resume'

class FakeContext implements ResumableContext {
  state = 'running'
  /** What resume() does: resolve and run, stay pending (iOS without a tap), or reject. */
  mode: 'runs' | 'hangs' | 'rejects' = 'runs'
  resumeCalls = 0
  private listeners = new Set<() => void>()

  resume(): Promise<void> {
    this.resumeCalls += 1
    if (this.mode === 'hangs') return new Promise(() => {})
    if (this.mode === 'rejects') return Promise.reject(new DOMException('not allowed', 'NotAllowedError'))
    this.set('running')
    return Promise.resolve()
  }

  set(state: string): void {
    this.state = state
    for (const listener of [...this.listeners]) listener()
  }

  addEventListener(_type: 'statechange', listener: () => void): void {
    this.listeners.add(listener)
  }

  removeEventListener(_type: 'statechange', listener: () => void): void {
    this.listeners.delete(listener)
  }

  get listenerCount(): number {
    return this.listeners.size
  }
}

class FakePage implements VisibilitySource {
  visibilityState = 'visible'
  private listeners = new Set<() => void>()
  addEventListener(_type: 'visibilitychange', listener: () => void): void {
    this.listeners.add(listener)
  }
  removeEventListener(_type: 'visibilitychange', listener: () => void): void {
    this.listeners.delete(listener)
  }
  set(state: string): void {
    this.visibilityState = state
    for (const listener of [...this.listeners]) listener()
  }
}

function setup(options: { active?: boolean } = {}) {
  const context = new FakeContext()
  const page = new FakePage()
  const blocked: boolean[] = []
  const timers: (() => void)[] = []
  let active = options.active ?? true
  const stop = watchAudioInterruptions(context, page, {
    isActive: () => active,
    onBlockedChange: (value) => blocked.push(value),
    setTimer: (fn) => {
      timers.push(fn)
      return timers.length - 1
    },
    clearTimer: (id) => {
      timers[id as number] = () => {}
    },
  })
  const flushTimers = () => {
    for (const fn of timers.splice(0)) fn()
  }
  return { context, page, blocked, stop, flushTimers, setActive: (value: boolean) => (active = value) }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('watchAudioInterruptions', () => {
  it('resumes by itself after an interruption when the browser allows it', async () => {
    const { context, blocked } = setup()
    context.set('interrupted')
    await settle()
    expect(context.resumeCalls).toBe(1)
    expect(context.state).toBe('running')
    expect(blocked).toEqual([])
  })

  it('asks for a tap when resume() stays pending (iOS outside a user gesture), then clears once audio runs', async () => {
    const { context, blocked, flushTimers } = setup()
    context.mode = 'hangs'
    context.set('interrupted')
    await settle()
    expect(blocked).toEqual([])
    flushTimers()
    expect(blocked).toEqual([true])
    // The owner taps: resume inside the gesture works.
    context.mode = 'runs'
    expect(await resumeFromTap(context)).toBe(true)
    expect(blocked).toEqual([true, false])
  })

  it('asks for a tap when resume() is refused', async () => {
    const { context, blocked } = setup()
    context.mode = 'rejects'
    context.set('suspended')
    await settle()
    expect(blocked).toEqual([true])
  })

  it('waits while the page is hidden and retries when it becomes visible', async () => {
    const { context, page, blocked } = setup()
    page.visibilityState = 'hidden'
    context.mode = 'rejects'
    context.set('suspended')
    await settle()
    expect(context.resumeCalls).toBe(0)
    context.mode = 'runs'
    page.set('visible')
    await settle()
    expect(context.resumeCalls).toBe(1)
    expect(context.state).toBe('running')
    expect(blocked).toEqual([])
  })

  it('does nothing when no call is live or the context is closed, and stops listening', async () => {
    const idle = setup({ active: false })
    idle.context.set('suspended')
    await settle()
    expect(idle.context.resumeCalls).toBe(0)

    const live = setup()
    live.context.set('closed')
    await settle()
    expect(live.context.resumeCalls).toBe(0)
    live.stop()
    expect(live.context.listenerCount).toBe(0)
    expect(await resumeFromTap(live.context)).toBe(false)
  })
})
