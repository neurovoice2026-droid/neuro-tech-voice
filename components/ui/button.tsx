import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import type { OrbState } from "@/components/shared/OrbLoader"
import { ButtonOrb } from "@/components/ui/button-orb"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // `outline-solid` sits next to `outline-2`: the base `outline-none` sets
  // --tw-outline-style to none, which `outline-2` alone would inherit.
  "group/button relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-[background-color,color,box-shadow,scale] duration-200 ease-out outline-none select-none active:not-aria-[haspopup]:scale-[0.97] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-2 aria-invalid:ring-destructive/30 data-[loading=true]:pointer-events-none data-[loading=true]:[&>svg]:hidden [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        outline:
          "bg-white text-foreground shadow-pill hover:bg-secondary aria-expanded:bg-secondary",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary-hover aria-expanded:bg-secondary-hover",
        ghost: "text-foreground hover:bg-secondary aria-expanded:bg-secondary",
        destructive:
          "bg-destructive-soft text-destructive hover:bg-[#fbdcd8]",
        "destructive-solid":
          "bg-destructive text-white hover:bg-destructive-hover",
        link: "text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground active:scale-100",
      },
      size: {
        xs: "h-7 gap-1.5 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-3 text-[13px] [&_svg:not([class*='size-'])]:size-3.5",
        default: "h-9 px-4 text-sm",
        lg: "h-11 px-5 text-[15px]",
        icon: "size-9",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-8",
        "icon-lg": "size-11",
      },
    },
    compoundVariants: [{ variant: "link", class: "h-auto rounded-none px-0" }],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /** Shows the 20 px thinking orb, marks the button busy and blocks clicks (focus is kept). */
    loading?: boolean
    /** Replaces the children while loading ("Saving…"). */
    loadingText?: React.ReactNode
    /** Orb state while loading (default 'working'; 'composing' for AI writing, 'connecting' for sync…). */
    loadingState?: OrbState
  }

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  loadingText,
  loadingState = "working",
  disabled,
  focusableWhenDisabled,
  children,
  ...props
}: ButtonProps) {
  // Ink fills need the light-dot orb; every other variant sits on white/tinted grey.
  const orbSurface = variant === "default" || variant === "destructive-solid" ? "dark" : "light"
  const iconOnly = typeof size === "string" && size.startsWith("icon")
  return (
    <ButtonPrimitive
      data-slot="button"
      data-loading={loading ? "true" : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      // While loading the button stays focusable (aria-disabled) so focus and the
      // busy state are not lost mid-action; Base UI still swallows the clicks.
      focusableWhenDisabled={loading ? true : focusableWhenDisabled}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading && (
        // Lazy: thinking-orbs is only fetched once a button is actually loading.
        <ButtonOrb
          state={loadingState}
          surface={orbSurface}
          className={iconOnly ? undefined : "-ml-0.5"}
        />
      )}
      {/* Direct <svg> children are hidden while loading (the orb takes their place);
          icon buttons keep their sr-only label as the accessible name. */}
      {loading && loadingText !== undefined ? loadingText : children}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
export type { ButtonProps }
