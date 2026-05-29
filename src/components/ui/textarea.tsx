import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-[10px] border border-line-strong bg-white px-3 py-2.5 text-[15px] leading-relaxed text-ink-900 transition-colors outline-none placeholder:text-ink-400 hover:border-blue-600/60 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/40 disabled:cursor-not-allowed disabled:bg-blue-50/60 disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
