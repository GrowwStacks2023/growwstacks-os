import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ResponsiveList — the single mechanism every list page uses to avoid
// horizontally-scrolling tables on narrow screens.
//
// Wide  (≥ md, 768px): proper table with all columns visible.
// Narrow (< md):       each row becomes a compact card stack.
//
// Usage:
//   <ResponsiveList
//     columns={[
//       { key: "name", label: "Name", widthHint: "30%" },
//       { key: "type", label: "Type" },
//       ...
//     ]}
//     rows={companies.map(c => ({
//       id: c.id,
//       cells: { name: <NameLink ... />, type: ... },
//       // optional summary text for narrow-mode card secondary line
//       href: `/dashboard/companies/${c.id}`,
//     }))}
//   />
//
// Each row needs an `id` for React keys. `cells` is a record keyed by
// column.key. If a `href` is set, the narrow-mode card is clickable.
//
// `primary` flags one column as the row's "headline" — it renders
// bolder + larger on the narrow-mode card.

export type ResponsiveColumn = {
  key: string;
  label: React.ReactNode;
  className?: string;
  widthHint?: string;
  primary?: boolean;
  // When false the column is hidden on narrow cards (defaults to true).
  showOnMobile?: boolean;
};

export type ResponsiveRow = {
  id: string;
  cells: Record<string, React.ReactNode>;
  href?: string;
};

export function ResponsiveList({
  columns,
  rows,
  empty,
  className,
}: {
  columns: ReadonlyArray<ResponsiveColumn>;
  rows: ReadonlyArray<ResponsiveRow>;
  empty?: React.ReactNode;
  className?: string;
}) {
  if (rows.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border bg-card/50 p-10 text-center text-[14px] text-muted-foreground",
          className
        )}
      >
        {empty ?? "Nothing to show yet."}
      </div>
    );
  }

  const primaryKey = columns.find((c) => c.primary)?.key ?? columns[0]?.key;

  return (
    <div className={cn("flex flex-col", className)}>
      {/* ──────────────── Wide: table ──────────────── */}
      <div className="hidden md:block rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((col, i) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    i === 0 && "pl-5",
                    i === columns.length - 1 && "pr-5",
                    col.className
                  )}
                  style={col.widthHint ? { width: col.widthHint } : undefined}
                >
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {columns.map((col, i) => (
                  <TableCell
                    key={col.key}
                    className={cn(
                      i === 0 && "pl-5 font-medium",
                      i === columns.length - 1 && "pr-5",
                      col.className
                    )}
                  >
                    {row.cells[col.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* ──────────────── Narrow: card stack ──────────────── */}
      <ul className="md:hidden flex flex-col gap-3">
        {rows.map((row) => {
          const inner = (
            <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4 transition-colors hover:border-brand-300">
              <div className="font-display text-[16px] font-semibold leading-tight tracking-[-0.005em] text-foreground">
                {row.cells[primaryKey]}
              </div>
              <dl className="grid grid-cols-1 gap-1.5 text-[14px]">
                {columns
                  .filter(
                    (c) =>
                      c.key !== primaryKey && (c.showOnMobile ?? true)
                  )
                  .map((col) => (
                    <div
                      key={col.key}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <dt className="text-[12px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
                        {col.label}
                      </dt>
                      <dd className="min-w-0 truncate text-right text-foreground/90">
                        {row.cells[col.key]}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
          );

          return (
            <li key={row.id}>
              {row.href ? (
                <a
                  href={row.href}
                  className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded-lg"
                >
                  {inner}
                </a>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
