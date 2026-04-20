import { ComponentProps, ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type EmptyStateProps = ComponentProps<"div"> & {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  actionLabel?: ReactNode
  onAction?: () => void
}

function EmptyState({
  className,
  icon,
  title,
  description,
  actionLabel,
  onAction,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex min-h-60 flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-secondary-system-background px-6 py-10 text-center",
        className
      )}
      {...props}
    >
      {icon ? (
        <div className="flex size-16 items-center justify-center rounded-full bg-system-fill text-tertiary-label [&_svg]:size-8">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <div className="font-sans text-headline text-label">{title}</div>
        {description ? (
          <div className="mx-auto max-w-xs text-subheadline text-secondary-label">
            {description}
          </div>
        ) : null}
      </div>
      {actionLabel && onAction ? (
        <Button onClick={onAction} size="sm" variant="secondary">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}

export { EmptyState }
