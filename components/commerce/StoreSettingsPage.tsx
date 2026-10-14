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
      toast.success('Datele magazinului au fost șterse', { description: 'Conexiunea, comenzile, clienții, produsele și automatizările au fost eliminate.' })
      setTyped('')
      onOpenChange(false)
      onDeleted()
    } catch (err) {
      toast.error('Datele magazinului nu au fost șterse', { description: commerceErrorMessage(err, 'Încearcă din nou.') })
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
          <DialogTitle>Ștergi datele magazinului?</DialogTitle>
          <DialogDescription>
            Șterge conexiunea cu {platformName(connection.platform)}, toate comenzile, clienții și produsele sincronizate, automatizările și istoricul lor. Apelurile rămân în pagina Apeluri. Nu se poate anula.
          </DialogDescription>
        </DialogHeader>
        <Field
          htmlFor={`${id}-confirm`}
          label={<span>Scrie <span className="font-semibold break-all">{expected}</span> ca să confirmi</span>}
          hint="Domeniul magazinului, exact cum apare mai sus."
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
            Renunță
          </Button>
          <Button variant="destructive-solid" onClick={() => void handleDelete()} disabled={!confirmed} loading={pending} loadingText="Se șterge…">
            Șterge datele magazinului
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
      <PageHeader eyebrow="Magazin" title="Setări magazin" description="Tipul de activitate al contului și datele magazinului." />

      <div className="max-w-[768px]">
        <SettingsSection id="store-connection" title="Magazin" description="Conexiunea curentă și datele sincronizate.">
          {isLoading ? (
            <Card className="py-0">
              <OrbLoader size={32} label="Se încarcă…" className="min-h-[120px]" />
            </Card>
          ) : error && connections.length === 0 ? (
            <Card className="gap-0 py-0">
              <CommerceCardError message="Conexiunea nu a putut fi citită." detail={error} onRetry={refetch} />
            </Card>
          ) : connections.length === 0 ? (
            <Card className="gap-0 py-0">
              <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[13px] leading-[19px] text-muted-foreground">Niciun magazin conectat.</p>
                <Link href="/magazin/conexiuni" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                  Conectează magazinul
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
                          {platformName(connection.platform)} · {formatCount(connection.counts.orders)} comenzi · {formatCount(connection.counts.customers)} clienți · {formatCount(connection.counts.products)} produse
                        </p>
                      </div>
                    </div>
                    <Link href="/magazin/conexiuni" className={cn(buttonVariants({ size: 'sm', variant: 'ghost' }), 'self-start sm:self-auto')}>
                      Gestionează
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </SettingsSection>

        <SettingsSection id="store-business-type" title="Tip de activitate" description="Alegerea făcută la configurarea contului.">
          <Card className="gap-0 py-0">
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <StatusChip tone="neutral">Magazin online</StatusChip>
                <p className="text-[13px] leading-[19px] text-muted-foreground">Panoul include secțiunea Magazin și automatizările pentru comenzi.</p>
              </div>
              <Alert className="mt-4" role="note">
                <Info aria-hidden="true" />
                <AlertTitle>Tipul de activitate nu se mai poate schimba după lansare</AlertTitle>
                <AlertDescription>
                  <p>
                    Secțiunea Magazin, datele sincronizate și automatizările depind de el. Dacă activitatea ta s-a schimbat, scrie-ne și
                    pregătim trecerea împreună, fără să pierzi apelurile și agentul.
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
                    <p className="mt-2">Contactează echipa de suport din contul tău.</p>
                  )}
                </AlertDescription>
              </Alert>
            </div>
          </Card>
        </SettingsSection>

        <SettingsSection id="store-danger" title="Zona periculoasă" titleClassName="text-destructive" description="Acțiuni permanente asupra datelor magazinului.">
          <div className="rounded-2xl bg-card p-5 shadow-[0_0_0_1px_rgb(179_38_30/0.18)]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="min-w-0">
                <p className="text-[15px] leading-[22px] font-medium text-foreground">Șterge datele magazinului</p>
                <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">
                  Elimină conexiunea, comenzile, clienții, produsele sincronizate și automatizările cu istoricul lor. Contul, agentul și apelurile rămân.
                </p>
              </div>
              <Button
                variant="destructive"
                className="self-start sm:shrink-0"
                disabled={isLoading || connections.length === 0}
                onClick={() => setDeleting(connections[0] ?? null)}
                title={connections.length === 0 ? 'Nu există date de șters' : undefined}
              >
                <Trash2 aria-hidden="true" />
                Șterge datele magazinului
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
