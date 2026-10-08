'use client'

import { isValidElement, useEffect, useRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CornerDot } from '@/components/site/corner-dot'
import { cn } from '@/lib/utils'

// ─── Radio-group keyboard model (WAI-ARIA APG "Radio Group") ──────────────────
// OptionCard and `Chip role="radio"` are plain buttons, so the group behaviour is
// added here and works inside any `role="radiogroup"` container: one Tab stop
// (the checked radio, or the first enabled one when none is checked), and the
// arrow keys move focus to the previous/next radio and select it. Home/End jump
// to the first/last. Outside a radiogroup the buttons behave as plain buttons.

function groupRadios(el: HTMLElement) {
  const group = el.closest<HTMLElement>('[role="radiogroup"]')
  if (!group) return null
  const all = Array.from(group.querySelectorAll<HTMLElement>('[role="radio"]')).filter(
    (r) => r.closest('[role="radiogroup"]') === group
  )
  const enabled = all.filter((r) => !r.hasAttribute('disabled') && r.getAttribute('aria-disabled') !== 'true')
  return { all, enabled }
}

/** Roving tabindex: only the checked (or first enabled) radio of the group is tabbable. */
function syncRovingTabIndex(el: HTMLElement) {
  const radios = groupRadios(el)
  if (!radios) return
  const current = radios.enabled.find((r) => r.getAttribute('aria-checked') === 'true') ?? radios.enabled[0]
  for (const r of radios.all) r.tabIndex = r === current ? 0 : -1
}

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

function handleRadioKeyDown(e: React.KeyboardEvent<HTMLElement>) {
  if (e.altKey || e.ctrlKey || e.metaKey) return
  const radios = groupRadios(e.currentTarget)
  if (!radios || radios.enabled.length === 0) return
  const { enabled } = radios
  const i = enabled.indexOf(e.currentTarget)
  let next: HTMLElement | undefined
  if (e.key in STEP) next = enabled[(i + STEP[e.key] + enabled.length) % enabled.length]
  else if (e.key === 'Home') next = enabled[0]
  else if (e.key === 'End') next = enabled[enabled.length - 1]
  if (!next) return
  e.preventDefault()
  next.focus()
  // Selection follows focus; clicking an already-checked radio is a no-op for callers.
  if (next !== e.currentTarget && next.getAttribute('aria-checked') !== 'true') next.click()
}

/** Wires the radio keyboard model when `isRadio`; re-syncs the tab stop after every render. */
function useRadioBehaviour<T extends HTMLElement>(isRadio: boolean) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (isRadio && ref.current) syncRovingTabIndex(ref.current)
  })
  return ref
}

interface OptionCardProps {
  selected: boolean
  onSelect: () => void
  /** Ink 18 px icon: a lucide component or an element. */
  icon?: LucideIcon | React.ReactElement
  title: React.ReactNode
  description?: React.ReactNode
  /** Chip next to the title (e.g. <Badge>Our pick</Badge>). */
  badge?: React.ReactNode
  disabled?: boolean
  className?: string
  /** Extra phrasing content (spans only — this renders inside a <button>). */
  children?: React.ReactNode
}

/**
 * Selectable tile with radio semantics (`role="radio"` + `aria-checked`). Unselected tiles are
 * tinted grey; the selected one is white with a 2 px ink ring and the violet corner dot.
 * The parent provides `role="radiogroup"` and an accessible label; inside it the cards get the
 * radio-group keyboard model (one Tab stop, arrow keys move and select).
 */
export function OptionCard({
  selected,
  onSelect,
  icon,
  title,
  description,
  badge,
  disabled,
  className,
  children,
}: OptionCardProps) {
  const ref = useRadioBehaviour<HTMLButtonElement>(true)
  let iconNode: React.ReactNode = null
  if (isValidElement(icon)) {
    iconNode = icon
  } else if (icon) {
    const Icon = icon
    iconNode = <Icon aria-hidden />
  }
  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      onKeyDown={handleRadioKeyDown}
      data-slot="option-card"
      data-selected={selected ? 'true' : undefined}
      className={cn(
        'relative flex w-full flex-col items-start gap-1 rounded-2xl p-4 text-left text-foreground transition-[background-color,box-shadow] duration-200 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50',
        selected ? 'bg-white shadow-[0_0_0_2px_var(--foreground)]' : 'bg-secondary hover:bg-secondary-hover',
        className
      )}
    >
      {selected && <CornerDot className="absolute top-3.5 right-3.5 size-2.5 text-brand" />}
      {iconNode && (
        <span className="mb-1 flex text-foreground [&>svg]:size-[18px] [&>svg]:shrink-0">{iconNode}</span>
      )}
      <span className="flex flex-wrap items-center gap-2 pr-4 text-sm leading-5 font-medium">
        {title}
        {badge}
      </span>
      {description && <span className="text-xs leading-4 text-muted-foreground">{description}</span>}
      {children}
    </button>
  )
}

interface ChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** On = ink, off = tinted grey. Exposed as aria-pressed (or aria-checked when role="radio"). */
  pressed: boolean
  size?: 'default' | 'sm'
}

/**
 * The site's toggle chip (tone/language pickers): ink when on, tinted grey when off.
 * `role="radio"` inside a `role="radiogroup"` gets the same keyboard model as OptionCard.
 */
export function Chip({ pressed, size = 'default', className, role, children, onKeyDown, ...props }: ChipProps) {
  const isRadio = role === 'radio'
  const ref = useRadioBehaviour<HTMLButtonElement>(isRadio)
  const state = isRadio || role === 'checkbox' ? { 'aria-checked': pressed } : { 'aria-pressed': pressed }
  return (
    <button
      ref={ref}
      type="button"
      role={role}
      {...state}
      onKeyDown={(e) => {
        onKeyDown?.(e)
        if (isRadio && !e.defaultPrevented) handleRadioKeyDown(e)
      }}
      data-slot="chip"
      data-state={pressed ? 'on' : 'off'}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full whitespace-nowrap transition-[background-color,color,scale] duration-200 outline-none select-none active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-3.5',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
        pressed ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-secondary-hover',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
