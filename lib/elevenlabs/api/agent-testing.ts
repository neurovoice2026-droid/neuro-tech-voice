import 'server-only'
// ElevenLabs agent testing (platform regression suite), verified against the
// official OpenAPI spec (2026-10):
//   POST   /v1/convai/agent-testing/create            CreateResponseUnitTestRequest | CreateToolCallUnitTestRequest | CreateSimulationTestRequest → {id}
//   GET    /v1/convai/agent-testing/{test_id}         Get*UnitTestResponseModel
//   PUT    /v1/convai/agent-testing/{test_id}         Update*UnitTestRequest (full replacement, idempotent)
//   DELETE /v1/convai/agent-testing/{test_id}
//   GET    /v1/convai/agent-testing?search&types[]&cursor&page_size(≤100) → GetTestsPageResponseModel {tests[], next_cursor, has_more}
//   POST   /v1/convai/agents/{agent_id}/run-tests     RunAgentTestsRequestModel {tests*[{test_id*}](1..5000), agent_config_override, branch_id, repeat_count(1..50)}
//                                                     → GetTestSuiteInvocationResponseModel
//   GET    /v1/convai/test-invocations/{id}            GetTestSuiteInvocationResponseModel {id*, test_runs*[UnitTestRunResponseModel], cancelled, …}
// Tests are WORKSPACE resources (shared by every tenant): admin/platform use
// only, never listed to a tenant. Creating a test and starting a run are not
// idempotent at the provider (a run also costs credits): never retried.
// include_folders (deprecated) is never sent; the deprecated simulation
// success_condition is never written (success_conditions[] instead).

import { NO_RETRY } from '@/lib/voice-providers/http'
import { req, T, type Ctx } from '../client'

const enc = encodeURIComponent
const BASE = '/v1/convai/agent-testing'

/** ConversationInitiationSource values the suite uses. */
export type TestInitiationSource = 'twilio' | 'react_sdk' | 'unknown'

/** ConversationHistoryTranscriptCommonModel-Input (role* and time_in_call_secs* only). */
export interface TestChatTurn {
  role: 'user' | 'agent'
  message: string
  time_in_call_secs: number
}

interface TestCommon {
  name: string
  chat_history: TestChatTurn[]
  dynamic_variables?: Record<string, string | number | boolean>
  conversation_initiation_source?: TestInitiationSource | null
}

/** CreateResponseUnitTestRequest / UpdateResponseUnitTestRequest (type 'llm'). */
export interface LlmTestBody extends TestCommon {
  type: 'llm'
  success_condition: string
  /** AgentSuccessfulResponseExample (≤ 5). */
  success_examples: Array<{ response: string; type: 'success' }>
  /** AgentFailureResponseExample (≤ 5). */
  failure_examples: Array<{ response: string; type: 'failure' }>
}

/** CreateToolCallUnitTestRequest / UpdateToolCallUnitTestRequest (type 'tool'). */
export interface ToolTestBody extends TestCommon {
  type: 'tool'
  tool_call_parameters: {
    /** ReferencedToolCommonModel: {id*, type*}. */
    referenced_tool: { id: string; type: 'system' | 'webhook' | 'client' }
    parameters: Array<{ path: string; eval: { type: 'anything' } | { type: 'llm'; description: string } }>
    verify_absence: boolean
  }
  check_any_tool_matches: boolean
}

export type AgentTestBody = LlmTestBody | ToolTestBody

export interface ELTestSummary {
  id: string
  name: string
  type: string
  created_at_unix_secs?: number
  last_updated_at_unix_secs?: number
}

/** TestRunStatus. */
export type ELTestRunStatus = 'pending' | 'passed' | 'failed' | 'cancelled'

/** UnitTestRunResponseModel (fields we use; never agent_responses: they are conversation content). */
export interface ELTestRun {
  test_run_id: string
  test_id: string
  test_name?: string
  status: ELTestRunStatus | string
  agent_id?: string
  /** TestConditionResultCommonModel {result: success|failure|unknown, rationale}. */
  condition_result?: { result?: string | null } | null
  credits_used?: number | null
  last_updated_at_unix?: number
}

/** GetTestSuiteInvocationResponseModel. */
export interface ELTestInvocation {
  id: string
  agent_id?: string | null
  version_id?: string | null
  created_at?: number
  cancelled?: boolean
  test_runs: ELTestRun[]
}

export function createAgentTest(body: AgentTestBody, ctx?: Ctx) {
  return req<{ id: string }>('agent_testing.create', `${BASE}/create`, { method: 'POST', body, retry: NO_RETRY, timeoutMs: T.write, ctx })
}

export function getAgentTest(testId: string, ctx?: Ctx) {
  return req<{ id: string; name: string; type?: string }>('agent_testing.get', `${BASE}/${enc(testId)}`, { ctx })
}

/** Full replacement of the test definition: re-sending the same body is idempotent. */
export function updateAgentTest(testId: string, body: AgentTestBody, ctx?: Ctx) {
  return req<{ id: string }>('agent_testing.update', `${BASE}/${enc(testId)}`, { method: 'PUT', body, timeoutMs: T.write, ctx })
}

export function deleteAgentTest(testId: string, ctx?: Ctx) {
  return req<void>('agent_testing.delete', `${BASE}/${enc(testId)}`, { method: 'DELETE', responseKind: 'none', ctx })
}

/** One page of the workspace's tests, narrowed by name (`search`) and type. Platform use only. */
export function listAgentTests(params: { search?: string; types?: Array<'llm' | 'tool' | 'simulation'>; cursor?: string | null; pageSize?: number } = {}, ctx?: Ctx) {
  return req<{ tests: ELTestSummary[]; next_cursor?: string | null; has_more: boolean }>('agent_testing.list', BASE, {
    query: {
      search: params.search,
      types: params.types,
      cursor: params.cursor ?? undefined,
      page_size: Math.min(Math.max(params.pageSize ?? 100, 1), 100),
    },
    ctx,
  })
}

/**
 * Starts a run of `testIds` on `agentId` (credits per test and repeat).
 * Not idempotent: never retried. Without agent_config_override the agent's
 * live configuration is tested.
 */
export function runAgentTests(
  agentId: string,
  params: { testIds: string[]; repeatCount?: number; agentConfigOverride?: { conversation_config: Record<string, unknown>; platform_settings: Record<string, unknown> } | null },
  ctx?: Ctx,
) {
  return req<ELTestInvocation>('agent_testing.run', `/v1/convai/agents/${enc(agentId)}/run-tests`, {
    method: 'POST',
    body: {
      tests: params.testIds.map((test_id) => ({ test_id })),
      ...(params.repeatCount && params.repeatCount > 1 ? { repeat_count: Math.min(Math.floor(params.repeatCount), 50) } : {}),
      ...(params.agentConfigOverride ? { agent_config_override: params.agentConfigOverride } : {}),
    },
    retry: NO_RETRY,
    timeoutMs: T.write,
    ctx,
  })
}

export function getTestInvocation(invocationId: string, ctx?: Ctx) {
  return req<ELTestInvocation>('agent_testing.invocation', `/v1/convai/test-invocations/${enc(invocationId)}`, { ctx })
}
