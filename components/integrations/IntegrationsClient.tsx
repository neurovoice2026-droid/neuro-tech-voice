'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, ExternalLink, Hash, Loader2, Lock, RefreshCw, ShieldCheck, Webhook } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { UpgradeNotice } from '@/components/shared/UpgradeNotice'
import { readApiError } from '@/components/workflows/api'
import type { GoogleIntegrationType } from '@/lib/workflows/types'
import { cn } from '@/lib/utils'
import type { Plan } from '@/types'
import { BetaBadge } from './BetaBadge'
import { GOOGLE_INTEGRATIONS, connectErrorMessage, type GoogleIntegrationInfo } from './catalog'

export interface GoogleConnection {
  connected: boolean
  /** Access stopped working (revoked or expired) and only reconnecting fixes it. */
  needs_reconnect: boolean
  account_email: string | null
  connected_at: string | null
}

interface IntegrationsClientProps {
  connections: Record<GoogleIntegrationType, GoogleConnection>
  /** A webhook address saved by the old integrations page (never used for sending). */
  legacyWebhookSaved: boolean
  google: { allowed: boolean; requiredPlan: Plan; available: boolean }
  /** False when the server couldn't read connections; the page says so instead of showing everything disconnected. */
  loaded: boolean
}

function GoogleCard({
  info,
  connection,
  allowed,
  available,
  busy,
  onDisconnect,
}: {
  info: GoogleIntegrationInfo
  connection: GoogleConnection
  allowed: boolean
  available: boolean
  busy: boolean
  onDisconnect: () => void
}) {
  const connected = connection.connected
  const broken = !connected && connection.needs_reconnect
  const canConnect = allowed && available
  return (
    <article
      className={cn(
        'rounded-2xl border-2 p-4 transition-colors sm:p-5',
        connected ? 'border-green-300 bg-green-50/40' : broken ? 'border-amber-300 bg-amber-50/40' : 'border-border bg-card hover:border-purple-200'
      )}
      aria-label={info.name}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl p-2', info.logoBg)}>
            <Image src={info.logo} alt="" width={28} height={28} className="object-contain" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-foreground">{info.name}</h3>
              <BetaBadge />
              {connected ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                  <CheckCircle2 className="size-2.5" aria-hidden="true" /> Connected
                </span>
              ) : broken ? (
                <span className="inline-flex items-center rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                  Needs reconnecting
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{info.description}</p>
            {broken ? (
              <p className="mt-1 text-xs text-amber-800">
                Google stopped accepting this connection (access was removed or expired). Reconnect to turn it back on.
              </p>
            ) : null}
            {connected && connection.account_email ? (
              <p className="mt-1 truncate text-xs text-foreground">
                Connected as <span className="font-medium">{connection.account_email}</span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end">
          {connected ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onDisconnect}
              disabled={busy}
              className="border-green-300 text-green-700 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
            >
              {busy ? <Loader2 className="animate-spin" /> : null}
              Disconnect
            </Button>
          ) : canConnect ? (
            <a href={`/api/integrations/google/connect?type=${info.type}`} className={cn(buttonVariants({ size: 'sm' }), 'purple-glow')}>
              {broken ? 'Reconnect' : 'Connect'}
            </a>
          ) : (
            <Button size="sm" disabled title={allowed ? 'Google connections are unavailable right now' : 'Available on a higher plan'}>
              <Lock /> Connect
            </Button>
          )}
          {broken ? (
            <button
              type="button"
              onClick={onDisconnect}
              disabled={busy}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
            >
              Remove
            </button>
          ) : null}
          {connected && canConnect ? (
            <a
              href={`/api/integrations/google/connect?type=${info.type}`}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            >
              <RefreshCw className="size-3" aria-hidden="true" /> Reconnect
            </a>
          ) : null}
        </div>
      </div>

      <ul className="mt-4 grid gap-1.5 sm:grid-cols-3">
        {info.capabilities.map((capability) => (
          <li key={capability} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn('size-1.5 shrink-0 rounded-full', connected ? 'bg-green-500' : 'bg-gray-300')} aria-hidden="true" />
            {capability}
          </li>
        ))}
      </ul>
    </article>
  )
}

export function IntegrationsClient({ connections: initial, legacyWebhookSaved, google, loaded }: IntegrationsClientProps) {
  const router = useRouter()
  const [connections, setConnections] = useState(initial)
  const [legacyWebhook, setLegacyWebhook] = useState(legacyWebhookSaved)
  // Fresh server data (router.refresh) replaces local state.
  const [source, setSource] = useState({ initial, legacyWebhookSaved })
  if (source.initial !== initial || source.legacyWebhookSaved !== legacyWebhookSaved) {
    setSource({ initial, legacyWebhookSaved })
    setConnections(initial)
    setLegacyWebhook(legacyWebhookSaved)
  }
  const [confirm, setConfirm] = useState<GoogleIntegrationInfo | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // Feedback when Google sends the owner back here (?connected=gmail or ?error=code).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const connected = params.get('connected')
    const error = params.get('error')
    if (!connected && !error) return
    if (connected) {
      const info = GOOGLE_INTEGRATIONS.find((item) => item.type === connected)
      toast.success(info ? `${info.name} connected` : 'Google connected', {
        description: 'You can now use it in your workflows.',
      })
    }
    if (error) toast.error(connectErrorMessage(error))
    router.replace('/integrations', { scroll: false })
  }, [router])

  const connectedGoogleCount = GOOGLE_INTEGRATIONS.filter((info) => connections[info.type].connected).length

  async function disconnect(info: GoogleIntegrationInfo) {
    setBusy(info.type)
    try {
      const res = await fetch(`/api/integrations/${info.type}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await readApiError(res, `We couldn’t disconnect ${info.name}. Please try again.`))
      setConnections((current) => ({ ...current, [info.type]: { connected: false, needs_reconnect: false, account_email: null, connected_at: null } }))
      toast.success(`${info.name} disconnected`)
      setConfirm(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `We couldn’t disconnect ${info.name}.`)
    } finally {
      setBusy(null)
    }
  }

  async function removeLegacyWebhook() {
    setBusy('webhook')
    try {
      const res = await fetch('/api/integrations/webhook', { method: 'DELETE' })
      if (!res.ok) throw new Error(await readApiError(res, 'We couldn’t remove the saved address. Please try again.'))
      setLegacyWebhook(false)
      toast.success('Saved address removed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'We couldn’t remove the saved address.')
    } finally {
      setBusy(null)
    }
  }

  const lastGoogle = confirm !== null && connections[confirm.type].connected && connectedGoogleCount === 1

  return (
    <div className="mx-auto w-full max-w-4xl p-4 sm:p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect the tools your business already uses. Your agent and your workflows use them for you after that.
        </p>
      </div>

      {!loaded ? (
        <div className="mb-6 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 sm:flex-row sm:items-center sm:justify-between">
          <span>We couldn’t check which services are connected. Your connections still work.</span>
          <Button size="xs" variant="outline" onClick={() => router.refresh()}>Try again</Button>
        </div>
      ) : null}

      <section className="mb-10" aria-labelledby="google-heading">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg border bg-white shadow-sm">
              <Image src="/integrari/google_calendar.svg" alt="" width={16} height={16} className="object-contain" />
            </div>
            <h2 id="google-heading" className="text-sm font-semibold text-foreground">Google Workspace</h2>
            <BetaBadge />
          </div>
          <div className="hidden h-px flex-1 bg-border sm:block" />
          <span className="text-xs text-muted-foreground">{connectedGoogleCount} of {GOOGLE_INTEGRATIONS.length} connected</span>
        </div>

        {!google.allowed ? (
          <UpgradeNotice
            feature="Google Workspace"
            requiredPlan={google.requiredPlan}
            description="Book appointments into Google Calendar during calls and send call details to Gmail, Sheets, Docs and Drive."
            className="mb-4"
          />
        ) : !google.available ? (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Google connections are unavailable right now, so new services can’t be connected. Please contact support.
          </p>
        ) : null}

        <div className="space-y-3">
          {GOOGLE_INTEGRATIONS.map((info) => (
            <GoogleCard
              key={info.type}
              info={info}
              connection={connections[info.type]}
              allowed={google.allowed}
              available={google.available}
              busy={busy === info.type}
              onDisconnect={() => setConfirm(info)}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="messaging-heading">
        <div className="mb-4 flex items-center gap-3">
          <h2 id="messaging-heading" className="text-sm font-semibold text-foreground">Slack and webhooks</h2>
          <div className="hidden h-px flex-1 bg-border sm:block" />
          <span className="text-xs text-muted-foreground">Set up inside a workflow</span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <article className="flex flex-col rounded-2xl border-2 border-border bg-card p-4 sm:p-5" aria-label="Slack">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-purple-50">
                <Hash className="size-5 text-purple-600" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground">Slack</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Post a message to a channel when a call ends, is missed, or mentions a word you pick. Paste a Slack incoming-webhook link into a
                  “Notify Slack” step; there’s nothing to install.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link href="/workflows" className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
                Set up in Workflows <ArrowRight />
              </Link>
              <a
                href="https://api.slack.com/messaging/webhooks"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Get a Slack link <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </div>
          </article>

          <article className="flex flex-col rounded-2xl border-2 border-border bg-card p-4 sm:p-5" aria-label="Custom webhook">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                <Webhook className="size-5 text-gray-600" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground">Custom webhook</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Send each call’s details as JSON to your CRM, Zapier, Make, n8n or your own server with a “Send webhook” step.
                </p>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5">
              {[
                'Signed with HMAC-SHA256 using a secret per workflow',
                'Retried up to 3 attempts when your endpoint is down',
                'Summary, outcome, tags and captured details included',
              ].map((item) => (
                <li key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-green-600" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            {legacyWebhook ? (
              <div className="mt-3 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-800 sm:flex-row sm:items-center">
                <span className="flex-1">
                  You saved a webhook address here before. It was never used to send anything; add it to a workflow’s “Send webhook” step instead.
                </span>
                <Button size="xs" variant="outline" onClick={() => void removeLegacyWebhook()} disabled={busy === 'webhook'}>
                  {busy === 'webhook' ? <Loader2 className="animate-spin" /> : null} Remove it
                </Button>
              </div>
            ) : null}
            <div className="mt-4">
              <Link href="/workflows" className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}>
                Set up in Workflows <ArrowRight />
              </Link>
            </div>
          </article>
        </div>
      </section>

      <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-dashed bg-muted/30 p-4">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Connecting a Google service opens Google’s own sign-in page, and we ask only for the permission that service needs. You can
          disconnect here at any time, or remove access from your Google Account settings.
        </p>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && busy === null && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disconnect {confirm?.name}?</DialogTitle>
            <DialogDescription>
              {confirm?.type === 'google_calendar'
                ? 'Your agent will stop checking your calendar and booking appointments, and calendar steps in your workflows will stop running.'
                : `Workflow steps that use ${confirm?.name} will stop running until you connect it again.`}
              {lastGoogle ? ' This is your last Google service, so we’ll also remove our access to your Google account.' : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy !== null}>Cancel</Button>
            <Button variant="destructive" onClick={() => confirm && void disconnect(confirm)} disabled={busy !== null}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {busy ? 'Disconnecting…' : 'Disconnect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
