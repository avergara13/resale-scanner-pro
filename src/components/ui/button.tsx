import { ComponentProps } from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-transparent px-4 font-sans text-callout font-semibold tracking-tight text-label transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-medium ease-spring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[var(--material-shadow)] hover:brightness-[0.98]",
        destructive:
          "bg-destructive text-primary-foreground shadow-[var(--material-shadow)] hover:brightness-[0.98] focus-visible:ring-destructive/20",
        outline:
          "border-border bg-card text-label shadow-sm hover:border-secondary-label/30 hover:bg-secondary-system-background",
        secondary:
          "border-border bg-secondary text-secondary-foreground shadow-sm hover:bg-muted",
        ghost:
          "bg-transparent text-label shadow-none hover:bg-system-fill",
        link: "min-h-0 rounded-none border-none bg-transparent px-0 py-0 text-primary shadow-none underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-4 py-2.5 has-[>svg]:px-3.5",
        sm: "min-h-11 gap-1.5 px-3.5 py-2 has-[>svg]:px-3",
        lg: "min-h-12 px-6 py-3 text-body has-[>svg]:px-5",
        icon: "size-11 px-0 py-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * Shared button primitive.
 * Use `variant="link"` only for inline text actions.
 * For standalone low-emphasis actions, prefer `variant="ghost"` with `size="sm"`.
 */
function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
