import { ConfigError, loadConfig } from './config'
import { createLogger } from './log'
import { createGatewayServer } from './server'
import { setListenerErrorHandler } from './util/emitter'

// Process entry: config, logging, crash guards, HTTP/WS server, graceful drain.

async function main(): Promise<void> {
  let config
  try {
    config = loadConfig()
  } catch (error) {
    const message = error instanceof ConfigError ? error.message : 'Invalid configuration'
    process.stderr.write(`${JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'voice gateway cannot start', error: message })}\n`)
    process.exit(1)
  }

  const log = createLogger(config.logLevel, { service: 'voice-gateway' })

  setListenerErrorHandler((error, event) => {
    log.error('event listener threw', { event, error: error instanceof Error ? error : String(error) })
  })
  // One broken call must never take the others down: log and keep serving.
  process.on('unhandledRejection', (reason) => {
    log.error('unhandled promise rejection', { error: reason instanceof Error ? reason : String(reason) })
  })
  process.on('uncaughtException', (error) => {
    log.error('uncaught exception', { error })
  })

  const server = createGatewayServer({ config, log })
  const port = await server.listen()
  log.info('voice gateway listening', {
    port,
    max_calls: config.maxConcurrentCalls,
    cartesia: !!config.cartesia.apiKey,
    openai: !!config.openai.apiKey,
    elevenlabs: !!config.elevenlabs.apiKey,
  })

  let shuttingDown = false
  const shutdown = (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    log.info('shutdown requested', { signal })
    server
      .shutdown()
      .catch((error: unknown) => log.error('shutdown error', { error: error instanceof Error ? error : String(error) }))
      .finally(() => {
        log.info('voice gateway stopped')
        process.exit(0)
      })
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

// A start-up failure (port in use, bad bind address) must exit so the platform
// restarts the machine, instead of leaving a process that serves nothing.
main().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({ ts: new Date().toISOString(), level: 'error', msg: 'voice gateway failed to start', error: error instanceof Error ? error.message : String(error) })}\n`
  )
  process.exit(1)
})
