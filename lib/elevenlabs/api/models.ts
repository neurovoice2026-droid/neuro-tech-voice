import 'server-only'
// Read-only catalogue endpoints (verified against the official OpenAPI spec,
// 2026-10). Workspace-wide data about models, never tenant data; used by the
// platform (agent sync, admin diagnostics) only and never proxied to tenants.

import { req, T, type Ctx } from '@/lib/elevenlabs/client'
import type { LlmReasoningEffort } from '@/lib/elevenlabs/models'

/** ModelResponseModel (subset we read). */
export interface ELModel {
  model_id: string
  name?: string
  can_do_text_to_speech?: boolean
  requires_alpha_access?: boolean
  maximum_text_length_per_request?: number
  token_cost_factor?: number
  /** LanguageResponseModel[]: language_id is an ISO code such as "en" or "ro". */
  languages?: Array<{ language_id: string; name?: string }>
}

/** LLMInfoModel (subset we read). */
export interface ELLlmInfo {
  llm: string
  is_checkpoint?: boolean
  /** Null when the model does not support configurable reasoning. */
  available_reasoning_efforts?: LlmReasoningEffort[] | null
  deprecation_info?: { is_deprecated?: boolean; replacement_model?: string | null; is_in_fallback_period?: boolean } | null
}

/** GET /v1/models: the models the workspace can use, with their languages. */
export function listModels(ctx?: Ctx) {
  return req<ELModel[]>('models.list', '/v1/models', { timeoutMs: T.read, ctx })
}

/** GET /v1/convai/llm/list: LLMs usable by agents, with reasoning levels and deprecations. */
export function listAgentLlms(ctx?: Ctx) {
  return req<{ llms: ELLlmInfo[] }>('llm.list', '/v1/convai/llm/list', { timeoutMs: T.read, ctx })
}
