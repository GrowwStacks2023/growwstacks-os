import Link from "next/link";
import { notFound } from "next/navigation";

import { AttachmentsCard } from "@/components/attachments";
import { DeleteAction } from "@/components/delete-action";
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
import { canDelete } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { userDisplay } from "@/lib/display";
import { TASK_PRIORITY, TASK_STATUS } from "@/lib/status-colors";
import { createClient } from "@/lib/supabase/server";

import { deleteContact } from "../mutations";

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
  const role = await getCurrentRole();
  const mayDelete = canDelete(role, "contact");
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

  // Tasks attached to this contact (standalone — no project / milestone).
  const { data: tasks } = await supabase
    .from("tasks")
    .select(
      "id, title, status, priority, due_at, assignee:users!tasks_assignee_id_fkey(name, email)"
    )
    .eq("contact_id", id)
    .order("created_at", { ascending: false });

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Contacts", href: "/dashboard/contacts" },
          { label: contact.name },
        ]}
        title={contact.name}
        description={
          <>
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
          </>
        }
        meta={
          contact.is_primary ? (
            <Badge variant="secondary">Primary</Badge>
          ) : null
        }
        action={
          mayDelete ? (
            <DeleteAction
              title={`Delete ${contact.name}?`}
              description="This cannot be undone. Deals, projects, or tasks referencing this contact must be detached first."
              onConfirm={async () => {
                "use server";
                return deleteContact(id);
              }}
              redirectTo="/dashboard/contacts"
            />
          ) : null
        }
      />

      <div className="flex flex-col gap-2">
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

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">Tasks</CardTitle>
              <CardDescription>
                Standalone tasks attached to this contact.
              </CardDescription>
            </div>
            <Button
              size="sm"
              render={
                <Link href={`/dashboard/tasks/new?contact=${contact.id}`} />
              }
            >
              Add task
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!tasks || tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tasks yet. Add one to keep track of a follow-up.
            </p>
          ) : (
            <ul className="divide-y">
              {tasks.map((task) => {
                const status = TASK_STATUS[task.status];
                const priority = TASK_PRIORITY[task.priority];
                return (
                  <li
                    key={task.id}
                    className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-1">
                      <Link
                        href={`/dashboard/tasks/${task.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {task.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {userDisplay(task.assignee, "Unassigned")}
                        {task.due_at
                          ? ` · due ${dateFormatter.format(new Date(task.due_at))}`
                          : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={priority.variant}
                        className={priority.className}
                      >
                        {priority.label}
                      </Badge>
                      <Badge
                        variant={status.variant}
                        className={status.className}
                      >
                        {status.label}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <AttachmentsCard
        entityType="contact"
        entityId={contact.id}
        revalidatePath={`/dashboard/contacts/${contact.id}`}
      />
    </Page>
  );
}
