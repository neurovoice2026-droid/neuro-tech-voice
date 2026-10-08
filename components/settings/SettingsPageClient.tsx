'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Building2, Clock, CreditCard, Mail, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { PageContainer } from '@/components/shared/PageContainer'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatusChip } from '@/components/shared/StatusChip'
import { DeleteAccountDialog } from '@/components/settings/DeleteAccountDialog'
import { cn } from '@/lib/utils'

interface SettingsPageClientProps {
  businessName: string | null
  email: string | null
  plan: string | null
  deletionRequested: boolean
}

/**
 * Same layout as the shared FormSection (label column 220 px, content right, hairline
 * between sections), composed here because each section must stay a labelled region
 * (`aria-labelledby` on the <section>), which FormSection does not pass through.
 */
function SettingsSection({
  id,
  title,
  description,
  titleClassName,
  children,
}: {
  id: string
  title: React.ReactNode
  description?: React.ReactNode
  titleClassName?: string
  children: React.ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className="grid gap-4 border-t border-rule py-8 first:border-t-0 first:pt-0 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10"
    >
      <div className="min-w-0">
        <h2 id={id} className={cn('text-[15px] leading-[22px] font-medium text-foreground', titleClassName)}>
          {title}
        </h2>
        {description && <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

function AccountRow({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <dt className="flex shrink-0 items-center gap-2 text-[13px] leading-[19px] text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" />
        {label}
      </dt>
      <dd className="min-w-0 text-sm leading-[21px] font-medium text-foreground sm:text-right">{children}</dd>
    </div>
  )
}

export function SettingsPageClient({ businessName, email, plan, deletionRequested }: SettingsPageClientProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <PageContainer width="narrow">
      <PageHeader eyebrow="Settings" title="Settings" description="Your account and its data." />

      <div>
        {/* Account */}
        <SettingsSection id="settings-account" title="Account" description="Your business and the email you sign in with.">
          <Card className="gap-0 py-0">
            <dl className="divide-y divide-rule">
              <AccountRow icon={Building2} label="Business name">
                {businessName?.trim() || 'Not set'}
              </AccountRow>
              <AccountRow icon={Mail} label="Sign-in email">
                <span className="break-all">{email ?? 'Unknown'}</span>
              </AccountRow>
              <AccountRow icon={CreditCard} label="Plan">
                <span className="flex flex-wrap items-center gap-3 sm:justify-end">
                  <StatusChip tone="neutral" className="capitalize">{plan ?? 'trial'}</StatusChip>
                  <Link
                    href="/billing"
                    // tap-44 gives the 19 px text link a 44 px target on touch screens.
                    className="relative tap-44 rounded-sm text-[13px] leading-[19px] font-medium text-foreground underline decoration-foreground/30 underline-offset-4 outline-none transition-[text-decoration-color] duration-200 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    Manage billing
                  </Link>
                </span>
              </AccountRow>
            </dl>
          </Card>
        </SettingsSection>

        {/* Danger zone */}
        <SettingsSection
          id="settings-danger"
          title="Danger zone"
          titleClassName="text-destructive"
          description="Permanent actions on your account."
        >
          {deletionRequested ? (
            <Alert variant="warning" role="status">
              <Clock aria-hidden="true" />
              <AlertTitle>Deletion in progress</AlertTitle>
              <AlertDescription>
                Your account is being deleted. We will email you when everything is gone.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-2xl bg-card p-5 shadow-[0_0_0_1px_rgb(179_38_30/0.18)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <p className="text-[15px] leading-[22px] font-medium text-foreground">Delete account</p>
                  <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">
                    Cancels your subscription, releases your numbers and permanently deletes your agent, calls and files.
                    You will need to have signed in within the last 30 minutes.
                  </p>
                </div>
                <Button variant="destructive" className="self-start sm:shrink-0" onClick={() => setDeleteOpen(true)}>
                  <Trash2 aria-hidden="true" />
                  Delete account
                </Button>
              </div>
            </div>
          )}
        </SettingsSection>
      </div>

      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} businessName={businessName} />
    </PageContainer>
  )
}
