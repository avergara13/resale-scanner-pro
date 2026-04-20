import { ChevronRight } from "lucide-react"
import { ComponentProps, ReactNode } from "react"

import { cn } from "@/lib/utils"

type GroupedRowProps = ComponentProps<"button"> & {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  trailing?: ReactNode
  showChevron?: boolean
}

function GroupedRow({
  className,
  icon,
  title,
  description,
  trailing,
  showChevron = false,
  type = "button",
  ...props
}: GroupedRowProps) {
  return (
    <button
      data-slot="grouped-row"
      type={type}
      className={cn(
        "flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left transition-[background-color,color] duration-fast ease-spring hover:bg-system-fill focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
        className
      )}
      {...props}
    >
      {icon ? (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-system-fill text-secondary-label [&_svg]:size-5">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-callout font-medium text-label">{title}</span>
        {description ? (
          <span className="block text-footnote text-secondary-label">
            {description}
          </span>
        ) : null}
      </span>
      {trailing ? (
        <span className="shrink-0 text-footnote text-secondary-label">
          {trailing}
        </span>
      ) : null}
      {showChevron ? (
        <ChevronRight className="size-4 shrink-0 text-tertiary-label" />
      ) : null}
    </button>
  )
}

export { GroupedRow }
