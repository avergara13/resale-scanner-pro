import { ComponentProps, ReactNode } from "react"

import { cn } from "@/lib/utils"

type SectionHeaderProps = ComponentProps<"div"> & {
  title: ReactNode
  detail?: ReactNode
}

function SectionHeader({
  className,
  title,
  detail,
  ...props
}: SectionHeaderProps) {
  return (
    <div
      data-slot="section-header"
      className={cn("flex items-end justify-between gap-3", className)}
      {...props}
    >
      <div className="text-footnote font-semibold tracking-wide text-secondary-label uppercase">
        {title}
      </div>
      {detail ? (
        <div className="text-footnote text-secondary-label">{detail}</div>
      ) : null}
    </div>
  )
}

export { SectionHeader }
