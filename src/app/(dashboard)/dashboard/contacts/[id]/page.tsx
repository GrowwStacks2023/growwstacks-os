import Link from "next/link";
import { notFound } from "next/navigation";

import { AttachmentsCard } from "@/components/attachments";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: contact, error } = await supabase
    .from("contacts")
    .select(
      "id, name, email, phone, whatsapp, role, is_primary, created_at, company:companies(id, name)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Couldn&apos;t load contact: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!contact) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/dashboard/contacts"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Contacts
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-2xl font-medium">{contact.name}</h1>
          {contact.is_primary ? (
            <Badge variant="secondary">Primary</Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          {contact.role ?? "—"}
          {contact.company ? (
            <>
              {" · "}
              <Link
                href={`/dashboard/companies/${contact.company.id}`}
                className="hover:underline"
              >
                {contact.company.name}
              </Link>
            </>
          ) : null}
        </p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Email:</dt>
            <dd>{contact.email ?? "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Phone:</dt>
            <dd>{contact.phone ?? "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">WhatsApp:</dt>
            <dd>{contact.whatsapp ?? "—"}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          Created {dateFormatter.format(new Date(contact.created_at))}
        </p>
      </div>

      <Separator />

      <AttachmentsCard
        entityType="contact"
        entityId={contact.id}
        revalidatePath={`/dashboard/contacts/${contact.id}`}
      />
    </div>
  );
}
