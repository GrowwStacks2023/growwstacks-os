import { guardSection } from "@/lib/access-server";

// Projects allows admin/sales/pm/developer. The sales-vs-others split
// (full vs read-only summary) is handled INSIDE the project pages
// via canEditProjectArea() — this layout just gates the section as a
// whole. Clients are blocked upstream by the dashboard layout.
export default async function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardSection("projects");
  return <>{children}</>;
}
