import { LoaderCircle } from "lucide-react"
import { ComponentProps } from "react"

import { cn } from "@/lib/utils"

function ActivityIndicator({
  className,
  ...props
}: ComponentProps<typeof LoaderCircle>) {
  return (
    <LoaderCircle
      aria-hidden="true"
      className={cn(
        "size-4 animate-spin text-secondary-label duration-1000",
        className
      )}
      {...props}
    />
  )
}

export { ActivityIndicator }
