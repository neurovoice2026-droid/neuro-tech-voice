"use client"

import { Progress as ProgressPrimitive } from "@base-ui/react/progress"

import { cn } from "@/lib/utils"

/**
 * Thin meter. `tone` colours the fill (convention: ≥ 80 % warning, ≥ 100 % danger);
 * `surface="tinted"` darkens the track for use inside a #f4f3f7 tile.
 */
function Progress({
  className,
  children,
  value,
  tone = "default",
  surface = "default",
  ...props
}: ProgressPrimitive.Root.Props & {
  tone?: "default" | "warning" | "danger"
  surface?: "default" | "tinted"
}) {
  return (
    <ProgressPrimitive.Root
      value={value}
      data-slot="progress"
      data-tone={tone}
      data-surface={surface}
      className={cn("group/progress flex flex-wrap gap-3", className)}
      {...props}
    >
      {children}
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressPrimitive.Root>
  )
}

function ProgressTrack({ className, ...props }: ProgressPrimitive.Track.Props) {
  return (
    <ProgressPrimitive.Track
      className={cn(
        "relative flex h-1.5 w-full items-center overflow-x-hidden rounded-full bg-secondary group-data-[surface=tinted]/progress:bg-[#e2e0e8]",
        className
      )}
      data-slot="progress-track"
      {...props}
    />
  )
}

function ProgressIndicator({
  className,
  ...props
}: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn(
        "h-full rounded-full bg-primary transition-[width] duration-500 ease-site group-data-[tone=warning]/progress:bg-warning-dot group-data-[tone=danger]/progress:bg-destructive",
        className
      )}
      {...props}
    />
  )
}

function ProgressLabel({ className, ...props }: ProgressPrimitive.Label.Props) {
  return (
    <ProgressPrimitive.Label
      className={cn("text-[13px] font-medium", className)}
      data-slot="progress-label"
      {...props}
    />
  )
}

function ProgressValue({ className, ...props }: ProgressPrimitive.Value.Props) {
  return (
    <ProgressPrimitive.Value
      className={cn(
        "ml-auto text-[13px] text-muted-foreground tabular-nums",
        className
      )}
      data-slot="progress-value"
      {...props}
    />
  )
}

export {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
}
