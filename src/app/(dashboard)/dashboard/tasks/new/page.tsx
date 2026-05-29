import { notFound } from "next/navigation";

import { Breadcrumbs, Page, type Crumb } from "@/components/page-shell";
import { NewTaskForm, type NewTaskFormContext } from "@/components/tasks/new-task-form";
import { FormCard } from "@/components/form";
import { createClient } from "@/lib/supabase/server";

// /dashboard/tasks/new
//   no query     → standalone task: mandatory contact picker inside the form
//   ?deal=<id>   → task attached to a deal
//   ?contact=<id>→ task attached to a contact (legacy entry point)
//
// All three paths share NewTaskForm, which builds the right TaskContext
// at submit time. createTaskDirect persists into the correct column set;
// the standalone path uses kind:"contact" with the picked contact id.
export default async function NewStandaloneTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ deal?: string; contact?: string }>;
}) {
  const params = await searchParams;
  const dealId = params.deal?.trim() || null;
  const contactId = params.contact?.trim() || null;

  // Only one of the two queries can be set at a time. Both set is a 404
  // (no legitimate way to land here with both).
  if (dealId && contactId) {
    notFound();
  }

  const supabase = await createClient();

  // Assignees and PM candidates are shared across all three paths.
  const [{ data: assignees }, { data: pmCandidates }] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, email")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("users")
      .select("id, name, email")
      .in("role", ["admin", "pm"])
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  let context: NewTaskFormContext;
  let cancelHref: string;
  let subtitle: React.ReactNode;
  let breadcrumbs: Crumb[];

  if (dealId) {
    const { data: deal } = await supabase
      .from("deals")
      .select("id, title")
      .eq("id", dealId)
      .maybeSingle();
    if (!deal) notFound();
    context = { kind: "deal", dealId: deal.id };
    cancelHref = `/dashboard/deals/${deal.id}`;
    subtitle = (
      <>
        Attached to deal{" "}
        <span className="font-semibold text-ink-900">{deal.title}</span>.
      </>
    );
    breadcrumbs = [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Deals", href: "/dashboard/deals" },
      { label: deal.title, href: `/dashboard/deals/${deal.id}` },
      { label: "New task" },
    ];
  } else if (contactId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, name")
      .eq("id", contactId)
      .maybeSingle();
    if (!contact) notFound();
    context = { kind: "contact", contactId: contact.id };
    cancelHref = `/dashboard/contacts/${contact.id}`;
    subtitle = (
      <>
        Attached to contact{" "}
        <span className="font-semibold text-ink-900">{contact.name}</span>.
      </>
    );
    breadcrumbs = [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Contacts", href: "/dashboard/contacts" },
      { label: contact.name, href: `/dashboard/contacts/${contact.id}` },
      { label: "New task" },
    ];
  } else {
    // True standalone path. Fetch contacts so the user can pick one inside
    // the form — contact is required to satisfy the tasks_one_context CHECK
    // (a task must hang off a milestone, deal, or contact).
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, name, company:companies(name)")
      .order("name", { ascending: true });

    context = {
      kind: "pickContact",
      contacts: (contacts ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        companyName: c.company?.name ?? null,
      })),
    };
    cancelHref = "/dashboard/tasks";
    subtitle =
      "Standalone task — pick the contact it belongs to. The task will be visible to admins, PMs, and the contact's company contacts.";
    breadcrumbs = [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Tasks", href: "/dashboard/tasks" },
      { label: "New task" },
    ];
  }

  return (
    <Page>
      <Breadcrumbs trail={breadcrumbs} />
      <FormCard title="New task" subtitle={subtitle}>
        <NewTaskForm
          context={context}
          assignees={assignees ?? []}
          pmCandidates={pmCandidates ?? []}
          cancelHref={cancelHref}
        />
      </FormCard>
    </Page>
  );
}
