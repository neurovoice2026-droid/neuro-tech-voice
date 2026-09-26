'use client'

import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SaveBarProps {
  dirty: boolean
  saving: boolean
  /** Message shown instead of saving when the form has errors. */
  invalidMessage?: string | null
  onSave: () => void
  onDiscard: () => void
  saveLabel?: string
}

/** Sticky footer for a settings tab: unsaved-changes state, discard and save. */
export function SaveBar({ dirty, saving, invalidMessage, onSave, onDiscard, saveLabel = 'Save changes' }: SaveBarProps) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80 sm:-mx-6 sm:px-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-h-5 text-xs text-muted-foreground" aria-live="polite">
          {invalidMessage && dirty ? (
            <span className="text-destructive">{invalidMessage}</span>
          ) : dirty ? (
            'You have unsaved changes.'
          ) : (
            'All changes saved.'
          )}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onDiscard} disabled={!dirty || saving} className="flex-1 sm:flex-none">
            Discard
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={!dirty || saving || Boolean(invalidMessage)}
            className="flex-1 sm:flex-none"
          >
            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
            {saving ? 'Saving…' : saveLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
