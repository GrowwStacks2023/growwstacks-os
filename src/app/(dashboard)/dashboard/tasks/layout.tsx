import { guardSection } from "@/lib/access-server";

// Tasks are accessible to admin/sales/pm/developer. Only clients are
// blocked (which the dashboard layout handles upstream). This guard is
// here for completeness — if the access matrix ever tightens, the lock
// lives in one place.
export default async function TasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardSection("tasks");
  return <>{children}</>;
}
