"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list text-muted-foreground group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col",
  {
    variants: {
      variant: {
        /** Segmented pill: tinted track, white active segment. */
        default: "inline-flex h-9 w-fit items-center gap-0.5 rounded-full bg-secondary p-1",
        /** Page tabs: hairline under the row, ink underline on the active tab. */
        // The hairline is an inset shadow, not border-b: the list scrolls (overflow-x),
        // which would clip an underline drawn over a real border.
        line: "flex h-11 w-full items-stretch justify-start gap-2 overflow-x-auto rounded-none bg-transparent p-0 shadow-[inset_0_-1px_0_var(--border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

type TabsListVariant = NonNullable<VariantProps<typeof tabsListVariants>["variant"]>

/** Lets each trigger pick plain (unprefixed) classes for its list's variant, so a caller's className merges over them. */
const TabsListVariantContext = React.createContext<TabsListVariant>("default")

function TabsList({
  className,
  variant = "default",
  children,
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  const resolved: TabsListVariant = variant ?? "default"
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={resolved}
      className={cn(tabsListVariants({ variant: resolved }), className)}
      {...props}
    >
      <TabsListVariantContext.Provider value={resolved}>{children}</TabsListVariantContext.Provider>
    </TabsPrimitive.List>
  )
}

const TRIGGER_VARIANT_CLASSES: Record<TabsListVariant, string> = {
  // Segmented pill: white active segment with the pill hairline. `flex-1` splits a
  // `w-full` track evenly (a `w-fit` track keeps natural widths); the 2 px focus
  // outline sits outside the segment (offset 2), inside the track's padding.
  default:
    "h-7 flex-1 rounded-full px-3 text-[13px] font-medium data-active:bg-white data-active:text-foreground data-active:shadow-pill focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring",
  // Page tabs: ink underline on the active tab — never purple. The list scrolls
  // (overflow-x), so an outline outside the trigger would be clipped by it: the
  // focus ring is drawn by `before:` inside the trigger, inset 6 px from the top
  // and bottom, and the 8 px side padding (gap-2 between tabs keeps the 24 px
  // label rhythm) leaves room for it next to the label. The underline spans the
  // label only (inset-x-2).
  line:
    "h-full flex-none rounded-none px-2 text-sm font-normal data-active:font-medium data-active:text-foreground before:pointer-events-none before:absolute before:inset-x-0 before:inset-y-1.5 before:rounded-[10px] focus-visible:before:outline-2 focus-visible:before:outline-solid focus-visible:before:outline-offset-[-2px] focus-visible:before:outline-ring after:pointer-events-none after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-foreground after:opacity-0 after:transition-opacity data-active:after:opacity-100",
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  const variant = React.useContext(TabsListVariantContext)
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        // `outline-solid` (in the variant classes) sits next to `outline-2`: the base
        // `outline-none` sets --tw-outline-style to none, which `outline-2` alone would inherit.
        "relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-muted-foreground transition-[color,background-color,box-shadow] duration-200 outline-none select-none hover:text-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        TRIGGER_VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
