import { CheckCircle2, AlertCircle, AlertTriangle, Info } from "lucide-react"
import { ComponentProps, ReactNode } from "react"

import { cn } from "@/lib/utils"

type StatusChipProps = ComponentProps<"span"> & {
  tone?: "info" | "success" | "warning" | "danger" | "neutral"
  icon?: ReactNode
}

const toneClassMap = {
  info: "border-primary/15 bg-primary/12 text-primary",
  success: "border-system-green/15 bg-system-green/12 text-system-green",
  warning: "border-system-orange/15 bg-system-orange/12 text-system-orange",
  danger: "border-destructive/15 bg-destructive/12 text-destructive",
  neutral: "border-border bg-system-fill text-secondary-label",
} as const

const toneIconMap = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
  neutral: Info,
} as const

function StatusChip({
  className,
  children,
  tone = "neutral",
  icon,
  ...props
}: StatusChipProps) {
  const Icon = toneIconMap[tone]

  return (
    <span
      data-slot="status-chip"
      className={cn(
        "inline-flex min-h-6 items-center gap-1 rounded-full border px-2.5 py-1 text-caption-1 font-medium",
        toneClassMap[tone],
        className
      )}
      {...props}
    >
      {icon ?? <Icon className="size-3.5" />}
      <span>{children}</span>
    </span>
  )
}

export { StatusChip }
