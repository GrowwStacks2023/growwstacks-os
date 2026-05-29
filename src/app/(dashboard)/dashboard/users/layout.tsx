import { guardSection } from "@/lib/access-server";

// Admin-only section. guardSection redirects non-admins to /dashboard.
export default async function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardSection("users");
  return <>{children}</>;
}
