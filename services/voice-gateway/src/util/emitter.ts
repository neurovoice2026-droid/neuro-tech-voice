// Tiny typed event emitter. Unlike node:events it has no special 'error'
// semantics (an unhandled 'error' must never crash a process serving other
// calls), and a throwing listener is reported instead of breaking the loop
// that emitted the event.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Listener = (...args: any[]) => void

export type EventMap = { [event: string]: Listener }

let listenerErrorHandler: (error: unknown, event: string) => void = (error, event) => {
  console.error(JSON.stringify({ level: 'error', msg: 'event listener threw', event, error: String(error) }))
}

export function setListenerErrorHandler(handler: (error: unknown, event: string) => void): void {
  listenerErrorHandler = handler
}

export class TypedEmitter<E extends EventMap> {
  private readonly listeners = new Map<keyof E, Set<Listener>>()

  on<K extends keyof E>(event: K, listener: E[K]): () => void {
    let set = this.listeners.get(event)
    if (!set) {
      set = new Set()
      this.listeners.set(event, set)
    }
    set.add(listener)
    return () => this.off(event, listener)
  }

  once<K extends keyof E>(event: K, listener: E[K]): () => void {
    const wrapped = ((...args: Parameters<E[K]>) => {
      this.off(event, wrapped as E[K])
      listener(...args)
    }) as E[K]
    return this.on(event, wrapped)
  }

  off<K extends keyof E>(event: K, listener: E[K]): void {
    this.listeners.get(event)?.delete(listener)
  }

  removeAllListeners(): void {
    this.listeners.clear()
  }

  protected emit<K extends keyof E>(event: K, ...args: Parameters<E[K]>): void {
    const set = this.listeners.get(event)
    if (!set || set.size === 0) return
    for (const listener of [...set]) {
      try {
        listener(...args)
      } catch (error) {
        listenerErrorHandler(error, String(event))
      }
    }
  }
}

/** Resolves after `ms`; the timer never keeps the process alive. */
export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve()
    const timer = setTimeout(resolve, ms)
    timer.unref?.()
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true }
    )
  })
}

/** A promise plus its resolver, for "wait until X happens" coordination. */
export interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  settled: boolean
}

export function deferred<T = void>(): Deferred<T> {
  let resolveFn!: (value: T) => void
  const d = {
    settled: false,
  } as Deferred<T>
  d.promise = new Promise<T>((resolve) => {
    resolveFn = resolve
  })
  d.resolve = (value: T) => {
    if (d.settled) return
    d.settled = true
    resolveFn(value)
  }
  return d
}
