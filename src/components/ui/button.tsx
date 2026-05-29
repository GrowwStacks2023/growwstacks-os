import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Spec v3:
//   Primary  → blue gradient (.btn-primary-gradient) + brand-glow shadow.
//   Outline  → white bg, --line-strong border, --ink-700 text;
//              hover border + text → --blue-600/700.
//   Ghost    → transparent; hover bg blue-50.
//   Link     → blue-600 underlined on hover.
//   Default  size h-10, radius 10px.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[10px] border border-transparent bg-clip-padding text-[14px] font-semibold tracking-[-0.005em] whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "btn-primary-gradient text-white hover:brightness-105",
        outline:
          "bg-white border-line-strong text-ink-700 hover:border-blue-600 hover:text-blue-700 aria-expanded:border-blue-600 aria-expanded:text-blue-700",
        secondary:
          "bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100 aria-expanded:bg-blue-100",
        ghost:
          "text-ink-700 hover:bg-blue-50 hover:text-blue-700 aria-expanded:bg-blue-50 aria-expanded:text-blue-700",
        destructive:
          "bg-red-100 text-red-600 hover:bg-red-100/80 border-red-100 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        link: "text-blue-600 underline-offset-4 hover:underline hover:text-blue-700",
      },
      size: {
        default:
          "h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-7 gap-1 rounded-[8px] px-2.5 text-[12px] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 rounded-[10px] px-3 text-[13px] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4 text-[15px]",
        icon: "size-10",
        "icon-xs":
          "size-6 rounded-[8px] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[10px] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  render,
  nativeButton,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      render={render}
      nativeButton={nativeButton ?? render === undefined}
      {...props}
    />
  )
}

export { Button, buttonVariants }
