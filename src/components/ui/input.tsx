import { ComponentProps } from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex min-h-11 w-full min-w-0 rounded-2xl border border-input bg-card px-4 py-2.5 font-sans text-callout text-label shadow-sm transition-[background-color,border-color,box-shadow,color] duration-medium ease-spring outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-footnote file:font-medium",
        "focus-visible:border-primary/35 focus-visible:ring-[3px] focus-visible:ring-ring/25",
        "aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
        "disabled:pointer-events-none disabled:cursor-not-allowed",
        "disabled:bg-system-fill disabled:text-muted-foreground disabled:border-border",
        "disabled:opacity-70",
        className
      )}
      {...props}
    />
  )
}

export { Input }
