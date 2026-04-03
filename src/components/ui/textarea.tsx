import { ComponentProps } from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] md:text-sm",
        "disabled:pointer-events-none disabled:cursor-not-allowed",
        "disabled:bg-muted/50 dark:disabled:bg-muted/20",
        "disabled:text-muted-foreground disabled:border-muted",
        "disabled:opacity-70",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
