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
        // Track — iOS 51×31px pill
        "peer inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer items-center rounded-full p-[2px]",
        // Transitions
        "transition-all duration-200 ease-in-out",
        // Focus ring
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        // Disabled
        "disabled:cursor-not-allowed disabled:opacity-40",
        // OFF track — light mode: frosted glass groove
        "data-[state=unchecked]:bg-black/[0.12] data-[state=unchecked]:shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.08)]",
        // OFF track — dark mode: frosted white
        "dark:data-[state=unchecked]:bg-white/[0.18] dark:data-[state=unchecked]:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.12)]",
        // ON track — app primary color (amber light / blue dark)
        "data-[state=checked]:bg-primary data-[state=checked]:shadow-none",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          // Thumb — 27×27px white pill with iOS-style lift shadow
          "pointer-events-none block size-[27px] rounded-full bg-white ring-0",
          // Shadow gives the floating-thumb depth iOS uses
          "shadow-[0_2px_6px_rgba(0,0,0,0.22),0_0.5px_1.5px_rgba(0,0,0,0.12)]",
          // Slide animation
          "transition-transform duration-200 ease-in-out",
          // 51px track − 27px thumb − 4px total padding = 20px travel
          "data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-[20px]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
