import { guardSection } from "@/lib/access-server";

// Replaces the per-page role-check that Task 10 added inline to the
// payments pages. Centralized here so the gate matches access.ts.
export default async function PaymentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardSection("payments");
  return <>{children}</>;
}
