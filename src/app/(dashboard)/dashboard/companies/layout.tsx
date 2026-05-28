import { guardSection } from "@/lib/access-server";

// Page-level gate for all /dashboard/companies/* routes. Developers and
// clients are bounced back to /dashboard (which they CAN see, modulo the
// client lockout that already redirected them). RLS independently blocks
// reads at the DB layer; this is the UI-level guard that keeps them off
// the page entirely.
export default async function CompaniesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardSection("companies");
  return <>{children}</>;
}
