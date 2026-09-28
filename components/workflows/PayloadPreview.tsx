'use client'

import { useMemo } from 'react'
import { Braces } from 'lucide-react'
import { buildWebhookPayload, sampleCallData, WEBHOOK_EVENT, WEBHOOK_HEADERS } from '@/lib/workflows/payload'
import type { TriggerType } from '@/lib/workflows/types'

/** The exact JSON a "Send webhook" step delivers, filled with a sample call. */
export function PayloadPreview({ trigger, workflowName }: { trigger: TriggerType; workflowName: string }) {
  const json = useMemo(() => {
    const payload = buildWebhookPayload({
      call: { ...sampleCallData(new Date('2026-09-17T09:44:02Z')), call_id: '9f1c2e4a-5b6d-4e7f-8a9b-0c1d2e3f4a5b', conversation_id: 'ac_7a2f…' },
      trigger,
      workflow: { id: 'your-workflow-id', name: workflowName.trim() || 'Your workflow' },
      deliveryId: 'a1b2c3d4-…',
      test: false,
      now: new Date('2026-09-17T09:48:12Z'),
    })
    return JSON.stringify(payload, null, 2)
  }, [trigger, workflowName])

  return (
    <details className="group rounded-lg border bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-medium text-foreground [&::-webkit-details-marker]:hidden">
        <Braces className="size-3.5 text-muted-foreground" aria-hidden="true" />
        What your endpoint receives
        <span className="ml-auto text-[11px] font-normal text-muted-foreground group-open:hidden">Show</span>
        <span className="ml-auto hidden text-[11px] font-normal text-muted-foreground group-open:inline">Hide</span>
      </summary>
      <div className="space-y-2 border-t px-3 py-2">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          One POST per matching call with <code className="font-mono">Content-Type: application/json</code>. If your endpoint is down or
          answers with an error (408, 429 or 5xx), we try again after 1 and 4 seconds, up to 3 attempts. Any other answer isn’t retried.
          Redirects are followed only when they keep the POST (307 or 308); paste the final address to be safe.
        </p>
        <ul className="space-y-0.5 font-mono text-[11px] text-muted-foreground">
          <li><span className="text-foreground">{WEBHOOK_HEADERS.event}</span>: {WEBHOOK_EVENT}</li>
          <li><span className="text-foreground">{WEBHOOK_HEADERS.delivery}</span>: the same id on every attempt</li>
          <li><span className="text-foreground">{WEBHOOK_HEADERS.attempt}</span>: 1, 2 or 3</li>
          <li className="break-all"><span className="text-foreground">{WEBHOOK_HEADERS.signature}</span>: t=&lt;unix time&gt;,v1=&lt;HMAC-SHA256 of “t.body”&gt;</li>
        </ul>
        <pre className="max-h-64 overflow-auto rounded-md bg-[#17131f] p-3 font-mono text-[11px] leading-5 text-white/85">{json}</pre>
      </div>
    </details>
  )
}
