"use client"

import { ComponentProps } from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  ...props
}: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-8 w-12 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-system-fill p-0.5 transition-[background-color,border-color,box-shadow] duration-medium ease-spring outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-40 data-[state=unchecked]:border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary/20",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-7 rounded-full bg-system-background shadow-[var(--material-shadow)] ring-0 transition-transform duration-medium ease-spring data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-4"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
