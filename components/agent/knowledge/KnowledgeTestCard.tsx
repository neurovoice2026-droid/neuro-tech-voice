'use client'

// "Test your knowledge base": ask a question the way a caller would and see
// which passages your agent would look up to answer it (no call is placed).

import { useId, useState } from 'react'
import { FileText, Globe, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Test your knowledge base</CardTitle>
        <CardDescription>Ask a question like a caller would and see what your agent would look up to answer it. No call is made.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <label htmlFor={inputId} className="sr-only">Test question</label>
          <Input
            id={inputId}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Are you open on Saturday?"
            maxLength={MAX_QUERY}
            disabled={asking || disabled}
            onKeyDown={(e) => e.key === 'Enter' && void ask()}
          />
          <Button onClick={() => void ask()} disabled={asking || disabled || query.trim().length < 2} className="shrink-0">
            {asking ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Search className="size-4" aria-hidden="true" />}
            <span className="ml-1.5">Ask</span>
          </Button>
        </div>
        {disabled && <p className="text-xs text-muted-foreground">Add a document or import your website first.</p>}

        {result && (
          <div className="space-y-2" aria-live="polite">
            {result.chunks.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Nothing in your knowledge base matches &quot;{result.query}&quot;. Add a document that answers it, or check that new documents
                have finished indexing.
              </p>
            ) : (
              result.chunks.map((c, i) => (
                <div key={`${c.document_id ?? c.document_name}-${i}`} className="space-y-1 rounded-lg border p-3">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    {c.source === 'website' ? <Globe className="size-3.5" aria-hidden="true" /> : <FileText className="size-3.5" aria-hidden="true" />}
                    <span className="truncate" title={c.source_url ?? c.document_name}>{c.document_name}</span>
                    {typeof c.distance === 'number' && (
                      <span className="ml-auto shrink-0 text-muted-foreground" title="How closely this passage matches the question">
                        {Math.max(0, Math.round((1 - c.distance) * 100))}% match
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">{c.text}</p>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
