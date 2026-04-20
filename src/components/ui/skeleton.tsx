import { cn } from "@/lib/utils"
import { ComponentProps } from "react"

function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-2xl bg-system-fill/80 animate-pulse",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
