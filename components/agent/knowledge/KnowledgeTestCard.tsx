'use client'

// "Test your knowledge base": ask a question the way a caller would and see
// which passages your agent would look up to answer it (no call is placed).

import { useId, useState } from 'react'
import { FileText, Globe, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormSection } from '@/components/shared/FormSection'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { cn } from '@/lib/utils'

interface TestChunk {
  document_id: string | null
  document_name: string
  source: 'document' | 'website'
  source_url: string | null
  text: string
  distance: number | null
}

const MAX_QUERY = 500

export function KnowledgeTestCard({ disabled }: { disabled?: boolean }) {
  const [query, setQuery] = useState('')
  const [asking, setAsking] = useState(false)
  const [result, setResult] = useState<{ query: string; chunks: TestChunk[] } | null>(null)
  const inputId = useId()

  const ask = async () => {
    const q = query.trim()
    if (q.length < 2 || asking) return
    setAsking(true)
    try {
      const res = await fetch('/api/agent/knowledge/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      const data: unknown = await res.json().catch((err: unknown) => {
        console.warn('[knowledge] unreadable test response', res.status, err)
        return null
      })
      if (!res.ok) {
        const message = data && typeof data === 'object' ? (data as { error?: unknown }).error : null
        toast.error(typeof message === 'string' && message ? message : 'The test could not be run. Please try again.')
        return
      }
      setResult({ query: q, chunks: ((data as { chunks?: TestChunk[] } | null)?.chunks ?? []) })
    } catch (err) {
      console.warn('[knowledge] test failed', err)
      toast.error('Network error. Check your connection and try again.')
    } finally {
      setAsking(false)
    }
  }

  return (
    <FormSection
      title="Test your knowledge base"
      description="Ask a question like a caller would and see what your agent would look up to answer it. No call is made."
    >
      <div>
        <div className="flex gap-2">
          <label htmlFor={inputId} className="sr-only">Test question</label>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            {/* Read-only (not disabled) while asking, so focus stays in the field after Enter. */}
            <Input
              id={inputId}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Are you open on Saturday?"
              maxLength={MAX_QUERY}
              disabled={disabled}
              readOnly={asking}
              className="rounded-full pl-9"
              onKeyDown={(e) => e.key === 'Enter' && void ask()}
            />
          </div>
          {/* Stays focusable while asking (aria-disabled), so focus is not dropped to the page. */}
          <Button
            variant="outline"
            onClick={() => void ask()}
            disabled={asking || disabled || query.trim().length < 2}
            focusableWhenDisabled={asking}
            className="h-10"
          >
            Ask
          </Button>
        </div>
        {disabled && <p className="mt-2 text-xs text-muted-foreground">Add a document or import your website first.</p>}

        {asking && (
          <OrbLoader
            size={32}
            layout="row"
            state="searching"
            label="Searching your documents…"
            delayMs={0}
            className="mt-5 min-h-14 rounded-2xl bg-secondary px-4"
          />
        )}

        {/* Always mounted, so a new answer is announced as an update of the same region. The previous
            answer stays on screen (dimmed) while the next question runs. */}
        <div aria-live="polite" aria-busy={asking || undefined}>
          {result && (
            <div className={cn('mt-5 space-y-2 transition-opacity duration-200', asking && 'opacity-60')}>
              {result.chunks.length === 0 ? (
                <p className="rounded-2xl bg-secondary px-4 py-3.5 text-[13px] leading-[19px] text-muted-foreground">
                  Nothing in your knowledge base matches &quot;{result.query}&quot;. Add a document that answers it, or check that new
                  documents have finished indexing.
                </p>
              ) : (
                <>
                  <p className="text-[11px] leading-4 font-medium tracking-[0.12em] text-muted-foreground uppercase">
                    What your agent would look up
                  </p>
                  {result.chunks.map((c, i) => (
                    <div key={`${c.document_id ?? c.document_name}-${i}`} className="rounded-2xl bg-secondary p-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="inline-flex h-6 min-w-0 items-center gap-1.5 rounded-full bg-white px-2.5 text-xs font-medium shadow-hair"
                          title={c.source_url ?? c.document_name}
                        >
                          {c.source === 'website' ? (
                            <Globe className="size-3 shrink-0" aria-hidden="true" />
                          ) : (
                            <FileText className="size-3 shrink-0" aria-hidden="true" />
                          )}
                          <span className="truncate">{c.document_name}</span>
                        </span>
                        {typeof c.distance === 'number' && (
                          <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums" title="How closely this passage matches the question">
                            {Math.max(0, Math.round((1 - c.distance) * 100))}% match
                          </span>
                        )}
                      </div>
                      <p className="mt-2.5 text-sm leading-[21px] whitespace-pre-line text-foreground/80">{c.text}</p>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </FormSection>
  )
}
