import 'server-only'
// The conversation initiation webhook an agent with native numbers is synced
// with (platform_settings.workspace_overrides.conversation_initiation_client_data_webhook):
// our public HTTPS URL and, by reference, the workspace secret its
// X-NTV-Tool-Key header carries (slice B1's ELEVENLABS_TOOL_SECRET, stored
// once as an ElevenLabs workspace secret). Without the secret there is no
// webhook: the route refuses unauthenticated requests, and native calls keep
// the agent's placeholders as before.
//
//   'write' (create/update)  obtains the secret id (created on first use);
//   'hash'  (config hash)    reads the stored id only, never creating anything.

import { createLogger, type Logger } from '@/lib/observability/logger'
import { publicBaseUrl } from '@/lib/voice-providers/config'
import { isReadyRow, readResourceRow } from '@/lib/voice-providers/platform-resources'
import { ensureToolSecret } from '@/lib/voice-providers/platform-tools'
import { toolSecretValue } from '@/lib/elevenlabs/tools/secret-config'

export const INITIATION_WEBHOOK_PATH = '/api/elevenlabs/initiation'

export async function initiationWebhookFor(mode: 'write' | 'hash', log: Logger = createLogger({ component: 'initiation_webhook' })): Promise<{ url: string; secretId: string } | null> {
  const base = publicBaseUrl()
  if (!base || !base.startsWith('https://') || !toolSecretValue()) return null
  const url = `${base}${INITIATION_WEBHOOK_PATH}`
  try {
    if (mode === 'hash') {
      const row = await readResourceRow('elevenlabs.tool_secret')
      return isReadyRow(row) ? { url, secretId: row.external_id } : null
    }
    const secretId = await ensureToolSecret({ verify: 'cached', log })
    return secretId ? { url, secretId } : null
  } catch (err) {
    // Never blocks the agent sync: native calls keep the placeholders.
    log.error('initiation_webhook.secret_unavailable', err, { mode })
    return null
  }
}
