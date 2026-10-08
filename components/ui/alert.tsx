import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  // An AlertAction is a grid cell, never an overlay: on phones it stacks under the
  // text (aligned with it); from `sm` it takes its own trailing column, centred
  // across the title and description rows (or on the title when there is no
  // description: then the icon, title and action are centred on one row).
  "group/alert relative grid w-full gap-0.5 rounded-xl px-4 py-3 text-left text-sm text-foreground has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-3 has-data-[slot=alert-description]:*:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg:not([class*='size-'])]:size-4 sm:has-data-[slot=alert-action]:grid-cols-[1fr_auto] sm:has-data-[slot=alert-action]:gap-x-3 sm:has-[>svg]:has-data-[slot=alert-action]:grid-cols-[auto_1fr_auto] sm:has-data-[slot=alert-action]:not-has-data-[slot=alert-description]:items-center sm:has-data-[slot=alert-action]:not-has-data-[slot=alert-description]:*:[svg]:translate-y-0",
  {
    variants: {
      variant: {
        default: "bg-secondary *:[svg]:text-muted-foreground",
        info: "bg-info-soft *:[svg]:text-info",
        success: "bg-success-soft *:[svg]:text-success",
        warning: "bg-warning-soft *:[svg]:text-warning",
        destructive:
          "bg-destructive-soft *:[svg]:text-destructive *:data-[slot=alert-title]:text-destructive",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "font-medium text-foreground group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-4",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-[13px] leading-[19px] text-balance text-foreground/75 group-has-[>svg]/alert:col-start-2 md:text-pretty [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_p:not(:last-child)]:mb-2",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn(
        "mt-2 flex flex-wrap items-center gap-2 justify-self-start group-has-[>svg]/alert:col-start-2 sm:col-start-[-2] sm:row-start-1 sm:group-has-data-[slot=alert-description]/alert:row-end-3 sm:mt-0 sm:ml-1 sm:self-center sm:justify-self-end sm:group-has-[>svg]/alert:col-start-[-2]",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
