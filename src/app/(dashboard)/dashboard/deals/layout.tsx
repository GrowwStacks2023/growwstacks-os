import { guardSection } from "@/lib/access-server";

export default async function DealsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardSection("deals");
  return <>{children}</>;
}
