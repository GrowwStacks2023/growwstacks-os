"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

// ─── Label-resolution context ────────────────────────────────────────────
// Root cause of "Select shows raw value instead of label":
//   Base UI's <Select.Value> resolves the displayed text via
//   resolveSelectedLabel(value, items, itemToStringLabel) in
//   node_modules/@base-ui/react/internals/resolveValueLabel.js. When the
//   consumer doesn't pass an `items` prop AND doesn't pass a children
//   render-function to <SelectValue>, it falls through to
//   `stringifyAsLabel(value)` — i.e. it prints the raw value string. Base
//   UI does NOT auto-collect labels from <Select.Item>'s JSX children.
//
// Fix at the primitive level (synchronous, no state, no effects):
//   The Select wrapper walks its `children` tree during render, finds
//   every <SelectItem> by component reference, and builds a
//   Map<string, ReactNode> of (value → label). The map is provided via
//   context to <SelectValue>, which supplies a default children
//   render-function that does labels.get(String(value)) ?? String(value).
//
//   Because the walk runs SYNCHRONOUSLY each render and SelectItem is a
//   thin pass-through (no state, no effects), the primitive is immune to
//   unstable option arrays. Earlier versions used a useEffect-based
//   register/unregister bottom-up registration; that combination
//   (unregister + register on every children-reference change) caused
//   an infinite "Maximum update depth exceeded" loop on forms with
//   dynamic options (Task 21 fix replaces it).
//
//   First paint shows the correct label — there's no
//   register-after-effect lag, so no flash for pre-selected values.
//
// Consumers can still pass `children` to <SelectValue> to override the
// default lookup, and they can still pass `items` directly to the Base
// UI root. This wrapper is additive.

type LabelMap = ReadonlyMap<string, React.ReactNode>;

const SelectLabelsContext = React.createContext<LabelMap | null>(null);

function useSelectLabels(): LabelMap | null {
  return React.useContext(SelectLabelsContext);
}

// Recursively walk the React children tree and harvest (value, children)
// pairs from every <SelectItem>. Handles Fragments and arbitrary wrapper
// components (SelectContent, SelectGroup, conditional <div>, etc.) by
// recursing into each element's `children` prop. Doesn't descend through
// SelectItem (items don't nest items).
function collectLabels(
  node: React.ReactNode,
  out: Map<string, React.ReactNode>
): void {
  React.Children.forEach(node, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === SelectItem) {
      const itemProps = child.props as {
        value?: unknown;
        children?: React.ReactNode;
      };
      if (itemProps.value != null) {
        out.set(String(itemProps.value), itemProps.children);
      }
      return;
    }
    // Recurse into wrappers / Fragments / native elements / etc.
    const childChildren = (child.props as { children?: React.ReactNode })
      .children;
    if (childChildren != null) {
      collectLabels(childChildren, out);
    }
  });
}

function Select<Value>(props: SelectPrimitive.Root.Props<Value>) {
  // Synchronous, render-time collection. Memoized on the children
  // reference: when consumers pass stable JSX the walk is paid once;
  // when they pass new JSX every render the walk is cheap (O(items)
  // for the few hundred entries any real Select carries) and produces a
  // value-equivalent map. The output reference changes per render in
  // the dynamic case, but that only causes <SelectValue> to re-render
  // (cheap, no effects), never a loop.
  const labels = React.useMemo<LabelMap>(() => {
    const m = new Map<string, React.ReactNode>();
    collectLabels(props.children, m);
    return m;
  }, [props.children]);

  return (
    <SelectLabelsContext.Provider value={labels}>
      <SelectPrimitive.Root {...props} />
    </SelectLabelsContext.Provider>
  );
}

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  )
}

function SelectValue({
  className,
  children,
  placeholder,
  ...props
}: SelectPrimitive.Value.Props) {
  const labels = useSelectLabels();

  // If the consumer already passed a children render-prop or a static
  // node, defer to them — don't clobber a custom render.
  const childrenProp =
    children ??
    ((value: unknown) => {
      if (value == null || value === "") return placeholder ?? null;
      if (Array.isArray(value)) {
        return value.map((v, i) => (
          <React.Fragment key={i}>
            {i > 0 ? ", " : null}
            {labels?.get(String(v)) ?? String(v)}
          </React.Fragment>
        ));
      }
      const looked = labels?.get(String(value));
      return looked ?? String(value);
    });

  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 text-left", className)}
      placeholder={placeholder}
      {...props}
    >
      {childrenProp}
    </SelectPrimitive.Value>
  );
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-[10px] border border-line-strong bg-white py-2 pr-2.5 pl-3 text-[15px] text-ink-900 whitespace-nowrap transition-colors outline-none select-none hover:border-blue-600/60 focus-visible:border-blue-600 focus-visible:ring-2 focus-visible:ring-blue-600/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30 data-placeholder:text-ink-400 data-[size=default]:h-10 data-[size=sm]:h-8 data-[size=sm]:rounded-[10px] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon
        render={
          <ChevronDownIcon className="pointer-events-none size-4 text-ink-500 transition-transform" />
        }
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger"
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn("relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-[12px] border border-line bg-white text-ink-900 shadow-[0_8px_30px_-10px_rgba(10,37,64,0.18)] duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("eyebrow px-2 py-1.5", className)}
      {...props}
    />
  )
}

// Thin pass-through. The Select wrapper harvests this item's label
// synchronously via React.Children — there is no per-item effect, no
// state, no bottom-up registration. That's what keeps the primitive
// loop-proof when consumers pass dynamic option arrays.
function SelectItem({
  className,
  children,
  value,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      value={value}
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-[8px] py-1.5 pr-8 pl-2 text-[14px] text-ink-700 outline-hidden select-none focus:bg-blue-50 focus:text-blue-700 not-data-[variant=destructive]:focus:**:text-blue-700 data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={
          <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />
        }
      >
        <CheckIcon className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        "top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronUpIcon
      />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        "bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      <ChevronDownIcon
      />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
