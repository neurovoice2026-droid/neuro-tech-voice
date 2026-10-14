'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Info, LifeBuoy, Store, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { CommerceCardError } from './ListScaffold'
import { Field } from '@/components/shared/FormSection'
import { OrbLoader } from '@/components/shared/OrbLoader'
import { PageContainer } from '@/components/shared/PageContainer'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusChip } from '@/components/shared/StatusChip'
import { commerceErrorMessage } from '@/hooks/useCommerceApi'
import { deleteConnection, useCommerceConnections } from '@/hooks/useCommerceConnections'
import { platformName } from '@/lib/commerce/platforms'
import type { ConnectionDto } from '@/lib/commerce/types'
import { cn } from '@/lib/utils'
import { formatCount } from './format'
import { STORE_PATHS } from './labels'
import { ConnectionStatusChip } from './StatusChips'

interface StoreSettingsPageProps {
  /** Who to contact about the business type (the account's type cannot change here). */
  support: { email: string | null; phone: string | null; phoneHref: string | null }
}

/** Same layout as the account Settings page (labelled sections, 768 px column). */
function SettingsSection({ id, title, description, titleClassName, children }: {
  id: string
  title: React.ReactNode
  description?: React.ReactNode
  titleClassName?: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t border-rule py-8 first:border-t-0 first:pt-0 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
      <div className="min-w-0">
        <h2 id={id} className={cn('text-[15px] leading-[22px] font-medium text-foreground', titleClassName)}>{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

/** DELETE /api/commerce/connections/[id] with the store domain typed back, like the account deletion. */
function DeleteStoreDialog({ connection, open, onOpenChange, onDeleted }: { connection: ConnectionDto; open: boolean; onOpenChange: (open: boolean) => void; onDeleted: () => void }) {
  const id = useId()
  const [typed, setTyped] = useState('')
  const [pending, setPending] = useState(false)
  const expected = connection.store_domain
  const confirmed = typed.trim().toLowerCase() === expected.toLowerCase()

  function close(next: boolean) {
    if (pending) return
    if (!next) setTyped('')
    onOpenChange(next)
  }

  async function handleDelete() {
    if (!confirmed) return
    setPending(true)
    try {
      await deleteConnection(connection.id, typed.trim())
      toast.success('Store data deleted', { description: 'The connection, orders, customers, products and automations were removed.' })
      setTyped('')
      onOpenChange(false)
      onDeleted()
    } catch (err) {
      toast.error('The store data was not deleted', { description: commerceErrorMessage(err, 'Try again.') })
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <span aria-hidden="true" className="mb-2 grid size-10 place-items-center rounded-full bg-destructive-soft text-destructive">
            <Trash2 className="size-[18px]" />
          </span>
          <DialogTitle>Delete the store data?</DialogTitle>
          <DialogDescription>
            Deletes the {platformName(connection.platform)} connection, every synced order, customer and product, the automations and their history. Calls stay on the Calls page. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <Field
          htmlFor={`${id}-confirm`}
          label={<span>Type <span className="font-semibold break-all">{expected}</span> to confirm</span>}
          hint="The store domain, exactly as shown above."
        >
          <Input
            id={`${id}-confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            maxLength={200}
            aria-invalid={typed.length > 0 && !confirmed}
            disabled={pending}
          />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={() => close(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive-solid" onClick={() => void handleDelete()} disabled={!confirmed} loading={pending} loadingText="Deleting…">
            Delete store data
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function StoreSettingsPage({ support }: StoreSettingsPageProps) {
  const { connections, isLoading, error, refetch, removeConnection } = useCommerceConnections()
  const [deleting, setDeleting] = useState<ConnectionDto | null>(null)

  return (
    <PageContainer>
      <PageHeader eyebrow="Store" title="Store settings" description="The account's business type and the store's data." />

      <div className="max-w-[768px]">
        <SettingsSection id="store-connection" title="Store" description="The current connection and the synced data.">
          {isLoading ? (
            <Card className="py-0">
              <OrbLoader size={32} label="Loading…" className="min-h-[120px]" />
            </Card>
          ) : error && connections.length === 0 ? (
            <Card className="gap-0 py-0">
              <CommerceCardError message="The connection could not be read." detail={error} onRetry={refetch} />
            </Card>
          ) : connections.length === 0 ? (
            <Card className="gap-0 py-0">
              <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13px] leading-[19px] text-muted-foreground">No store connected.</p>
                <Link href={STORE_PATHS.connections} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                  Connect store
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </Card>
          ) : (
            <Card className="gap-0 py-0">
              <ul className="divide-y divide-rule">
                {connections.map((connection) => (
                  <li key={connection.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-foreground">
                        <Store className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                          {connection.display_name?.trim() || connection.store_domain}
                          <ConnectionStatusChip status={connection.status} />
                        </p>
                        <p className="mt-0.5 text-[13px] leading-[19px] text-muted-foreground tabular-nums">
                          {platformName(connection.platform)} · {formatCount(connection.counts.orders)} orders · {formatCount(connection.counts.customers)} customers · {formatCount(connection.counts.products)} products
                        </p>
                      </div>
                    </div>
                    <Link href={STORE_PATHS.connections} className={cn(buttonVariants({ size: 'sm', variant: 'ghost' }), 'self-start sm:self-auto')}>
                      Manage
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </SettingsSection>

        <SettingsSection id="store-business-type" title="Business type" description="The choice made when the account was set up.">
          <Card className="gap-0 py-0">
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <StatusChip tone="neutral">Online store</StatusChip>
                <p className="text-[13px] leading-[19px] text-muted-foreground">The dashboard includes the Store section and the order automations.</p>
              </div>
              <Alert className="mt-4" role="note">
                <Info aria-hidden="true" />
                <AlertTitle>The business type cannot be changed after launch</AlertTitle>
                <AlertDescription>
                  <p>
                    The Store section, the synced data and the automations depend on it. If your business has changed, write to us and
                    we will prepare the switch together, without losing your calls or your agent.
                  </p>
                  {support.email ? (
                    <a href={`mailto:${support.email}`} className="mt-2 inline-flex items-center gap-1.5">
                      <LifeBuoy className="size-3.5" aria-hidden="true" />
                      {support.email}
                    </a>
                  ) : support.phone && support.phoneHref ? (
                    <a href={support.phoneHref} className="mt-2 inline-flex items-center gap-1.5">
                      <LifeBuoy className="size-3.5" aria-hidden="true" />
                      {support.phone}
                    </a>
                  ) : (
                    <p className="mt-2">Contact support from your account.</p>
                  )}
                </AlertDescription>
              </Alert>
            </div>
          </Card>
        </SettingsSection>

        <SettingsSection id="store-danger" title="Danger zone" titleClassName="text-destructive" description="Permanent actions on the store's data.">
          <div className="rounded-2xl bg-card p-5 shadow-[0_0_0_1px_rgb(179_38_30/0.18)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <p className="text-[15px] leading-[22px] font-medium text-foreground">Delete store data</p>
                <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">
                  Removes the connection, the synced orders, customers and products, and the automations with their history. The account, the agent and the calls stay.
                </p>
              </div>
              <Button
                variant="destructive"
                className="self-start sm:shrink-0"
                disabled={isLoading || connections.length === 0}
                onClick={() => setDeleting(connections[0] ?? null)}
                title={connections.length === 0 ? 'There is no data to delete' : undefined}
              >
                <Trash2 aria-hidden="true" />
                Delete store data
              </Button>
            </div>
          </div>
        </SettingsSection>
      </div>

      {deleting && (
        <DeleteStoreDialog
          connection={deleting}
          open
          onOpenChange={(open) => !open && setDeleting(null)}
          onDeleted={() => {
            removeConnection(deleting.id)
            refetch()
          }}
        />
      )}
    </PageContainer>
  )
}
