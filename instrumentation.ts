// Runs once per server instance at startup (skipped during `next build`).
// Logs voice-provider configuration problems by key name only (never values),
// so a missing secret is visible in the deployment logs immediately instead
// of surfacing as failed calls later.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const [{ validateVoiceConfig }, { createLogger }] = await Promise.all([
    import('@/lib/voice-providers/config'),
    import('@/lib/observability/logger'),
  ])
  const log = createLogger({ component: 'startup' })
  const problems = validateVoiceConfig()
  for (const p of problems) {
    if (p.severity === 'error') log.error('config.problem', null, { key: p.key, message: p.message })
    else log.warn('config.problem', { key: p.key, message: p.message })
  }
  log.info('config.checked', { errors: problems.filter((p) => p.severity === 'error').length, warnings: problems.filter((p) => p.severity === 'warning').length })
}

/** Structured, redacted record of unhandled server errors (no query strings: they can carry call tokens). */
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
) {
  const { createLogger } = await import('@/lib/observability/logger')
  createLogger({ component: 'request_error' }).error('request.unhandled', err, {
    method: request.method,
    path: request.path.split('?')[0],
    routePath: context.routePath,
    routeType: context.routeType,
  })
}
