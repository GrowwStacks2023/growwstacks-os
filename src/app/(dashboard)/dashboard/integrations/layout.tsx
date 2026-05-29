import { guardSection } from "@/lib/access-server";

// Admin-only section.
export default async function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardSection("integrations");
  return <>{children}</>;
}
