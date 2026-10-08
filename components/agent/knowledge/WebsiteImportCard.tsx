'use client'

// "Import your website": the voice provider reads up to N pages of the
// owner's own site (same domain), keeps them up to date weekly, and the agent
// searches them during calls. Requires an explicit ownership confirmation.

import { useId, useState } from 'react'
import { AlertCircle, Globe, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormSection } from '@/components/shared/FormSection'
import { OrbInline, OrbLoader } from '@/components/shared/OrbLoader'
import { StatusChip } from '@/components/shared/StatusChip'
import { isWebsiteImportRunning, type WebsiteImport, type useKnowledgeWebsite } from '@/hooks/useKnowledgeWebsite'
import { formatDate, formatFileSize } from '@/lib/utils'
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
    <FormSection
      title="Import your website"
      description={`Your agent learns your services, prices and opening hours from up to ${maxPages} pages of your site, kept up to date every week.`}
    >
      <div className="space-y-3">
        <label htmlFor={urlId} className="sr-only">Website address</label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Globe className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id={urlId}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.yourbusiness.ro"
              className="pl-9"
              inputMode="url"
              maxLength={2048}
              disabled={isImporting || running}
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
            />
          </div>
          <Button
            variant="outline"
            onClick={() => void submit()}
            disabled={!canImport}
            loading={isImporting}
            loadingState="searching"
            loadingText="Starting…"
            className="h-10"
          >
            Import
          </Button>
        </div>
        <div className="flex items-start gap-2.5">
          <Checkbox id={consentId} checked={consent} onCheckedChange={(v) => setConsent(v === true)} disabled={isImporting} className="mt-px" />
          <label htmlFor={consentId} className="text-xs leading-[18px] text-muted-foreground">
            I own this website or I am authorised to import it. Only pages on this domain are read, and they are processed by our voice
            provider to answer your callers.
          </label>
        </div>
        {running && <p className="text-xs text-muted-foreground">An import is running. You can start another one when it finishes.</p>}
      </div>

      {websites.length > 0 && (
        <ul className="overflow-hidden rounded-2xl bg-white shadow-hair" aria-label="Imported websites">
          {websites.map((w) => (
            <WebsiteRow key={w.id} site={w} isRemoving={removing.includes(w.id)} onRemove={() => setRemoveTarget(w)} />
          ))}
        </ul>
      )}

      <Dialog open={!!removeTarget} onOpenChange={(open) => !open && !removing.length && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove website?</DialogTitle>
            <DialogDescription>
              The pages imported from {removeTarget?.host} will be removed from your agent&apos;s knowledge. You can import the site again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)} disabled={removing.length > 0}>Cancel</Button>
            <Button variant="destructive-solid" onClick={() => void confirmRemove()} loading={removing.length > 0} loadingText="Removing…">
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormSection>
  )
}

function WebsiteRow({ site, isRemoving, onRemove }: { site: WebsiteImport; isRemoving: boolean; onRemove: () => void }) {
  const running = isWebsiteImportRunning(site)
  const total = Math.max(site.pages_identified, site.pages_scraped, 1)
  const pct = Math.min(100, Math.round((site.pages_scraped / Math.min(total, site.max_pages)) * 100))
  return (
    <li className="flex items-start gap-3 border-b border-rule px-4 py-3.5 last:border-b-0">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary" aria-hidden="true">
        <Globe className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm leading-5 font-medium" title={site.seed_url}>{site.host}</p>
        {running ? (
          <div className="mt-2 space-y-2.5">
            {/* Static label: the live region is announced once per stage, not on every 5-second poll. */}
            <OrbLoader
              size={32}
              layout="row"
              state={site.status === 'processing' ? 'searching' : 'breathing'}
              delayMs={0}
              label={site.status === 'processing' ? 'Reading pages…' : 'Waiting to start…'}
              description="You can leave this page"
            />
            <div className="flex items-center gap-3">
              <Progress value={pct} className="min-w-0 flex-1" aria-label={`Import progress for ${site.host}`} />
              {site.status === 'processing' && (
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {site.pages_scraped} {site.pages_scraped === 1 ? 'page' : 'pages'} read
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            {site.status === 'succeeded' ? (
              <StatusChip tone="success" dot className="tabular-nums">
                {site.page_count} {site.page_count === 1 ? 'page' : 'pages'}
              </StatusChip>
            ) : site.status === 'deleting' ? (
              <StatusChip tone="muted" icon={<OrbInline state="working" />}>Removing…</StatusChip>
            ) : (
              <StatusChip tone="danger" icon={<AlertCircle aria-hidden="true" />}>
                {site.status === 'cancelled' ? 'Cancelled' : 'Failed'}
              </StatusChip>
            )}
            {site.status === 'succeeded' && <RagBadge status={site.rag_status} progress={site.rag_progress} />}
            {site.status === 'succeeded' && (site.size_bytes > 0 || site.finished_at) && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {[
                  site.size_bytes > 0 ? formatFileSize(site.size_bytes) : null,
                  site.finished_at ? `Imported ${formatDate(site.finished_at)} · updates weekly` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
          </div>
        )}
        {site.error_message && site.status !== 'succeeded' && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-destructive">
            <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            {site.error_message}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        disabled={site.status === 'deleting'}
        loading={isRemoving}
        className="tap-44 -mr-1.5 text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
        title={running ? 'Stop and remove this import' : 'Remove this website'}
        aria-label={`Remove website ${site.host}`}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </li>
  )
}
