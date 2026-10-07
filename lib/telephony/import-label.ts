// Label of a number imported natively into the shared ElevenLabs workspace:
// `ntv:<environment>:<organization uuid>`. The environment marker (the same
// one agents carry in their `ntv-env:` tag) lets one workspace serve several
// deployments: an import labelled for another environment is never adopted,
// replaced or reported as an orphan here. Pure.

const LABEL = /^ntv:([a-z0-9_-]{1,20}):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

/** This deployment's environment marker (VERCEL_ENV, else NODE_ENV). */
export function deploymentEnv(): string {
  const raw = (process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development').toLowerCase()
  return raw.replace(/[^a-z0-9_-]/g, '').slice(0, 20) || 'development'
}

export function nativeImportLabel(orgId: string): string {
  return `ntv:${deploymentEnv()}:${orgId}`
}

/** Prefix shared by every import of this environment (admin orphan report). */
export function importLabelPrefix(): string {
  return `ntv:${deploymentEnv()}:`
}

/** {env, orgId} of a label written by nativeImportLabel, or null (legacy `ntv <8 chars>` labels, manual imports). */
export function parseImportLabel(label: string | null | undefined): { env: string; orgId: string } | null {
  const m = LABEL.exec((label ?? '').trim())
  return m ? { env: m[1].toLowerCase(), orgId: m[2].toLowerCase() } : null
}
