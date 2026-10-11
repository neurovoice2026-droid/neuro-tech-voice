'use client'

// Password-field pieces shared by the sign-up and set-new-password forms.

import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Password strength helpers ────────────────────────────────────────────────
export function getPasswordStrength(password: string): number {
  if (!password) return 0
  const has8 = password.length >= 8
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSpecial = /[^A-Za-z0-9]/.test(password)
  if (has8 && hasUpper && hasNumber && hasSpecial) return 4
  if (has8 && hasUpper && hasNumber) return 3
  if (has8 && (hasUpper || hasNumber)) return 2
  if (has8 || hasUpper || hasNumber) return 1
  return 0
}

// Semantic status tones (spec §3.4): the meter fill carries the level, the
// label says it in words, so colour is never the only signal.
const STRENGTH_META = [
  { label: '',       bar: '',                text: '' },
  { label: 'Weak',   bar: 'bg-destructive',  text: 'text-destructive' },
  { label: 'Fair',   bar: 'bg-warning-dot',  text: 'text-warning' },
  { label: 'Good',   bar: 'bg-primary',      text: 'text-foreground' },
  { label: 'Strong', bar: 'bg-success-dot',  text: 'text-success' },
]

/**
 * Strength meter: always laid out (empty bars until something is typed) and
 * the label slot is a fixed 48 × 16 px, so typing never moves the fields below.
 * `rejected`: the server refused the password as unsafe (found in a breach,
 * too weak), so the meter must not call it strong next to that error.
 */
export function PasswordStrengthMeter({ password, rejected = false }: { password: string; rejected?: boolean }) {
  const strength = rejected && password ? 1 : getPasswordStrength(password)
  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              'h-1 flex-1 rounded-full transition-colors duration-300 ease-site',
              i <= strength ? STRENGTH_META[strength].bar : 'bg-border'
            )}
          />
        ))}
      </div>
      <p
        className={cn(
          'h-4 w-12 shrink-0 text-right text-xs leading-4 font-medium',
          STRENGTH_META[strength].text
        )}
      >
        {STRENGTH_META[strength].label}
      </p>
    </div>
  )
}

// ─── Show/hide password (ghost icon button inside the field) ──────────────────
export function PasswordToggle({
  controls,
  shown,
  onToggle,
}: {
  /** id of the password input it shows/hides. */
  controls: string
  shown: boolean
  onToggle: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onToggle}
      className="tap-44 absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      aria-label={shown ? 'Hide password' : 'Show password'}
      aria-controls={controls}
    >
      {shown ? <EyeOff /> : <Eye />}
    </Button>
  )
}
