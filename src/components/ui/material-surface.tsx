import { ComponentProps } from "react"

import { cn } from "@/lib/utils"

type MaterialSurfaceProps = ComponentProps<"div"> & {
  material?: "ultraThin" | "thin" | "regular" | "thick" | "chrome"
}

const materialClassMap = {
  ultraThin: "material-ultra-thin",
  thin: "material-thin",
  regular: "material-regular",
  thick: "material-thick",
  chrome: "material-chrome",
} as const

function MaterialSurface({
  className,
  material = "regular",
  ...props
}: MaterialSurfaceProps) {
  return (
    <div
      data-slot="material-surface"
      className={cn(
        materialClassMap[material],
        "border border-border/80 shadow-[var(--material-shadow)]",
        className
      )}
      {...props}
    />
  )
}

export { MaterialSurface }
