import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-[10px] border border-line-strong bg-white px-3 py-2 text-[15px] leading-snug text-ink-900 transition-colors outline-none file:inline-flex file:h-7 file:mr-2 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-ink-400 hover:border-blue-600/60 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-blue-50/60 disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
        className
      )}
      {...props}
    />
  )
}

export { Input }
