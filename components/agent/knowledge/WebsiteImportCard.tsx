'use client'

// "Import your website": the voice provider reads up to N pages of the
// owner's own site (same domain), keeps them up to date weekly, and the agent
// searches them during calls. Requires an explicit ownership confirmation.

import { useId, useState } from 'react'
import { AlertCircle, CheckCircle2, Globe, Loader2, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { isWebsiteImportRunning, type WebsiteImport, type useKnowledgeWebsite } from '@/hooks/useKnowledgeWebsite'
import { cn, formatDate, formatFileSize } from '@/lib/utils'
import { RagBadge } from './KnowledgeBadges'

interface WebsiteImportCardProps {
  hook: ReturnType<typeof useKnowledgeWebsite>
  maxPages: number
  defaultUrl?: string | null
}

export function WebsiteImportCard({ hook, maxPages, defaultUrl }: WebsiteImportCardProps) {
  const { websites, isImporting, removing, importWebsite, removeWebsite } = hook
  const [url, setUrl] = useState(defaultUrl ?? '')
  const [consent, setConsent] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<WebsiteImport | null>(null)
  const consentId = useId()
  const urlId = useId()
  const running = websites.some(isWebsiteImportRunning)
  const trimmed = url.trim()
  const normalized = trimmed && !/^https?:\/\//i.test(trimmed) ? `https://${trimmed}` : trimmed
  const canImport = !!trimmed && consent && !isImporting && !running

  const submit = async () => {
    if (!canImport) return
    const ok = await importWebsite(normalized)
    if (ok) setConsent(false)
  }

  const confirmRemove = async () => {
    if (!removeTarget) return
    const ok = await removeWebsite(removeTarget.id)
    if (ok) setRemoveTarget(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Import your website</CardTitle>
        <CardDescription>
          Your agent learns your services, prices and opening hours from up to {maxPages} pages of your site, kept up to date every week.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label htmlFor={urlId} className="sr-only">Website address</label>
          <div className="flex gap-2">
            <Input
              id={urlId}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.yourbusiness.ro"
              className="flex-1"
              inputMode="url"
              maxLength={2048}
              disabled={isImporting || running}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
            />
            <Button onClick={() => void submit()} disabled={!canImport} className="shrink-0">
              {isImporting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Globe className="size-4" aria-hidden="true" />}
              <span className="ml-1.5">{isImporting ? 'Starting…' : 'Import'}</span>
            </Button>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox id={consentId} checked={consent} onCheckedChange={(v) => setConsent(v === true)} disabled={isImporting} className="mt-0.5" />
            <label htmlFor={consentId} className="text-xs leading-relaxed text-muted-foreground">
              I own this website or I am authorised to import it. Only pages on this domain are read, and they are processed by our voice
              provider to answer your callers.
            </label>
          </div>
          {running && <p className="text-xs text-muted-foreground">An import is running. You can start another one when it finishes.</p>}
        </div>

        {websites.length > 0 && (
          <div className="space-y-2">
            {websites.map((w) => (
              <WebsiteRow key={w.id} site={w} isRemoving={removing.includes(w.id)} onRemove={() => setRemoveTarget(w)} />
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!removeTarget} onOpenChange={(open) => !open && !removing.length && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove website?</DialogTitle>
            <DialogDescription>
              The pages imported from {removeTarget?.host} will be removed from your agent&apos;s knowledge. You can import the site again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removing.length > 0}>Cancel</Button>
            <Button variant="destructive" onClick={() => void confirmRemove()} disabled={removing.length > 0}>
              {removing.length > 0 && <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden="true" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function WebsiteRow({ site, isRemoving, onRemove }: { site: WebsiteImport; isRemoving: boolean; onRemove: () => void }) {
  const running = isWebsiteImportRunning(site)
  const total = Math.max(site.pages_identified, site.pages_scraped, 1)
  const pct = Math.min(100, Math.round((site.pages_scraped / Math.min(total, site.max_pages)) * 100))
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <Globe className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-medium" title={site.seed_url}>{site.host}</p>
        <div className="flex flex-wrap items-center gap-2">
          {running ? (
            <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-xs text-blue-700">
              <Loader2 aria-hidden="true" className="animate-spin" />
              {site.status === 'processing' ? `Reading pages… ${site.pages_scraped}` : 'Waiting to start…'}
            </Badge>
          ) : site.status === 'succeeded' ? (
            <Badge variant="outline" className="gap-1 border-green-200 bg-green-50 text-xs text-green-700">
              <CheckCircle2 aria-hidden="true" />
              {site.page_count} {site.page_count === 1 ? 'page' : 'pages'}
            </Badge>
          ) : site.status === 'deleting' ? (
            <Badge variant="outline" className="text-xs">Removing…</Badge>
          ) : (
            <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-xs text-red-700">
              <AlertCircle aria-hidden="true" />
              {site.status === 'cancelled' ? 'Cancelled' : 'Failed'}
            </Badge>
          )}
          {site.status === 'succeeded' && site.size_bytes > 0 && <span className="text-xs text-muted-foreground">{formatFileSize(site.size_bytes)}</span>}
          {site.status === 'succeeded' && <RagBadge status={site.rag_status} progress={site.rag_progress} />}
          {site.status === 'succeeded' && site.finished_at && (
            <span className="text-xs text-muted-foreground">Imported {formatDate(site.finished_at)} · updates weekly</span>
          )}
        </div>
        {running && <Progress value={pct} className="h-1" aria-label={`Import progress for ${site.host}`} />}
        {site.error_message && site.status !== 'succeeded' && <p className="text-xs text-destructive">{site.error_message}</p>}
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={isRemoving || site.status === 'deleting'}
        className={cn('shrink-0 rounded-md p-1.5 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50')}
        title={running ? 'Stop and remove this import' : 'Remove this website'}
        aria-label={`Remove website ${site.host}`}
      >
        {isRemoving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
      </button>
    </div>
  )
}
