"use client"

import dynamic from "next/dynamic"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon } from "lucide-react"

/*
 * The Toaster lives in the root layout, so a static import of the orb would
 * ship `thinking-orbs` to every marketing page. Loaded on demand instead: the
 * chunk is fetched the first time a loading toast is shown (the 20 px slot is
 * reserved meanwhile so the toast does not shift).
 */
const LoadingOrb = dynamic(
  () => import("@/components/shared/OrbLoader").then((m) => m.OrbInline),
  { ssr: false, loading: () => <span aria-hidden className="inline-flex size-5 shrink-0" /> }
)

/**
 * Light theme is pinned: the product is light-only, and sonner's "system" would
 * follow a dark OS. (next-themes is not used — there is no ThemeProvider.)
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-success-dot" />,
        info: <InfoIcon className="size-4 text-foreground" />,
        warning: <TriangleAlertIcon className="size-4 text-warning-dot" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <LoadingOrb state="working" surface="light" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "transparent",
          "--border-radius": "20px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast font-sans shadow-pop! gap-3!",
          title: "text-sm font-medium",
          description: "text-[13px] text-muted-foreground!",
          actionButton: "rounded-full! bg-primary! text-primary-foreground! h-8! px-3!",
          cancelButton: "rounded-full! bg-secondary! text-foreground!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
