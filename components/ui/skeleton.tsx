import { cn } from "@/lib/utils"

/** Static placeholder block (no pulse). Retired from app surfaces — waiting states use OrbLoader. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("rounded-lg bg-secondary", className)}
      {...props}
    />
  )
}

export { Skeleton }
