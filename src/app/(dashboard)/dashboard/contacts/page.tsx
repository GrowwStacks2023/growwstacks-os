import Link from "next/link";

import { Page, PageHeader } from "@/components/page-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";

export default async function ContactsPage() {
  const supabase = await createClient();
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select(
      "id, name, email, phone, whatsapp, is_primary, company:companies(name)"
    )
    .order("created_at", { ascending: false });

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Contacts" },
        ]}
        title="Contacts"
        description="People you work with — at companies or standalone."
        action={
          <Button render={<Link href="/dashboard/contacts/new" />}>
            New contact
          </Button>
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            Couldn&apos;t load contacts: {error.message}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        {!contacts || contacts.length === 0 ? (
          <>
            <CardHeader>
              <CardTitle className="text-base">No contacts yet</CardTitle>
              <CardDescription>
                No contacts yet. Create your first one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button render={<Link href="/dashboard/contacts/new" />}>
                Create contact
              </Button>
            </CardContent>
          </>
        ) : (
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead className="pr-4">Primary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="pl-4 font-medium">
                      <Link
                        href={`/dashboard/contacts/${contact.id}`}
                        className="hover:underline"
                      >
                        {contact.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.company?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.phone ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {contact.whatsapp ?? "—"}
                    </TableCell>
                    <TableCell className="pr-4">
                      {contact.is_primary ? (
                        <Badge variant="secondary">Primary</Badge>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>
    </Page>
  );
}
