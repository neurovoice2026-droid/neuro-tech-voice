"use client"

import dynamic from "next/dynamic"

import type { OrbState, OrbSurface } from "@/components/shared/OrbLoader"
import { cn } from "@/lib/utils"

/*
 * `thinking-orbs` is fetched the first time a button actually shows `loading`, so
 * pages that only render idle buttons (the legal pages' header, the auth forms
 * before submit) do not ship it. The 20 px slot is reserved while the chunk loads.
 */
const LazyOrbInline = dynamic(
  () => import("@/components/shared/OrbLoader").then((m) => m.OrbInline),
  { ssr: false, loading: () => null }
)

/** The 20 px loading orb inside `Button` (decorative: the button carries aria-busy and the text). */
export function ButtonOrb({
  state,
  surface,
  className,
}: {
  state: OrbState
  surface: OrbSurface
  className?: string
}) {
  return (
    <span
      aria-hidden
      data-slot="button-orb"
      className={cn("inline-flex size-5 shrink-0 items-center justify-center", className)}
    >
      <LazyOrbInline state={state} surface={surface} />
    </span>
  )
}
