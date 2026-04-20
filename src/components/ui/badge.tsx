import { ComponentProps } from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex min-h-6 w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 font-sans text-caption-1 font-medium tracking-normal overflow-hidden transition-[background-color,border-color,color,box-shadow] duration-medium ease-spring [&>svg]:size-3.5 [&>svg]:pointer-events-none focus-visible:ring-[3px] focus-visible:ring-ring/25 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20",
  {
    variants: {
      variant: {
        default:
          "border-primary/15 bg-primary/12 text-primary [a&]:hover:bg-primary/16",
        secondary:
          "border-border bg-secondary text-secondary-foreground [a&]:hover:bg-system-fill",
        destructive:
          "border-destructive/15 bg-destructive/12 text-destructive [a&]:hover:bg-destructive/18 focus-visible:ring-destructive/20",
        outline:
          "border-border bg-transparent text-label [a&]:hover:bg-system-fill",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
