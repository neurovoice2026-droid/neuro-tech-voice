'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Building2, CreditCard, Mail, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DeleteAccountDialog } from '@/components/settings/DeleteAccountDialog'

interface SettingsPageClientProps {
  businessName: string | null
  email: string | null
  plan: string | null
  deletionRequested: boolean
}

export function SettingsPageClient({ businessName, email, plan, deletionRequested }: SettingsPageClientProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account and its data.</p>
      </div>

      {/* Account */}
      <section aria-labelledby="settings-account" className="rounded-2xl border bg-card p-5 space-y-4">
        <h2 id="settings-account" className="text-sm font-semibold text-foreground">Account</h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            Business name
          </dt>
          <dd className="font-medium text-foreground">{businessName?.trim() || 'Not set'}</dd>
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            Sign-in email
          </dt>
          <dd className="font-medium text-foreground break-all">{email ?? 'Unknown'}</dd>
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
            Plan
          </dt>
          <dd className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">{plan ?? 'trial'}</Badge>
            <Link href="/billing" className="text-xs font-medium text-primary hover:underline">Manage billing</Link>
          </dd>
        </dl>
      </section>

      {/* Danger zone */}
      <section aria-labelledby="settings-danger" className="rounded-2xl border border-red-200 bg-card p-5 space-y-3">
        <h2 id="settings-danger" className="flex items-center gap-1.5 text-sm font-semibold text-red-700">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          Danger zone
        </h2>
        {deletionRequested ? (
          <p role="status" className="text-sm text-muted-foreground">
            Your account is being deleted. We will email you when everything is gone.
          </p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Delete account</p>
              <p className="text-sm text-muted-foreground">
                Cancels your subscription, releases your numbers and permanently deletes your agent, calls and files.
                You will need to have signed in within the last 30 minutes.
              </p>
            </div>
            <Button variant="destructive" className="gap-1.5 sm:flex-shrink-0" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete account
            </Button>
          </div>
        )}
      </section>

      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} businessName={businessName} />
    </div>
  )
}
