import { guardSection } from "@/lib/access-server";

export default async function ContactsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await guardSection("contacts");
  return <>{children}</>;
}
