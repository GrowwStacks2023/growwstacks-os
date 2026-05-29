import { cn } from "@/lib/utils";

// Spec v3 form layout. Every "create" or "edit" form sits inside this
// shell:
//   - Only a breadcrumb is allowed at the page top — the title and the
//     subtitle live INSIDE this card, above a hairline separator.
//   - White surface, --line border, 14px radius, --shadow-md.
//   - Max width 680px, horizontally centered on the page.
//   - Below the separator: vertical stack of fields (gap-5).
//   - Footer actions sit on a second hairline-separated row, right
//     aligned, ghost-Cancel + primary-Save. The FormActions primitive
//     already renders that row, so just place it as the last child.
export function FormCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[680px]">
      <div
        className={cn(
          "rounded-[14px] border border-line bg-white shadow-[0_6px_20px_-8px_rgba(10,37,64,0.18),0_2px_6px_rgba(10,37,64,0.06)]",
          className
        )}
      >
        <header className="border-b border-line px-7 py-6">
          <h2 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink-900">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-2 text-[14px] leading-relaxed text-ink-500">
              {subtitle}
            </p>
          ) : null}
        </header>
        <div className="px-7 py-6">{children}</div>
      </div>
    </div>
  );
}
