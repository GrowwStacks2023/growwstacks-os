import { notFound } from "next/navigation";

import { Breadcrumbs, Page, type Crumb } from "@/components/page-shell";
import { NewTaskForm } from "@/components/tasks/new-task-form";
import type { TaskContext } from "@/components/tasks/actions";
import { FormCard } from "@/components/form";
import { createClient } from "@/lib/supabase/server";

// /dashboard/tasks/new?deal=<id> or ?contact=<id>
//
// Universal standalone-task create route. Reads the context from query
// params, validates that the referenced deal/contact exists (and is
// visible per RLS), then renders the shared NewTaskForm with the right
// context shape. The milestone-scoped route at
// /dashboard/projects/[id]/milestones/[milestoneId]/tasks/new still works
// — both routes use the same NewTaskForm.
export default async function NewStandaloneTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ deal?: string; contact?: string }>;
}) {
  const params = await searchParams;
  const dealId = params.deal?.trim() || null;
  const contactId = params.contact?.trim() || null;

  // Exactly one of {deal, contact} must be set. Anything else is a 404 —
  // there's no legitimate way to land here without a context.
  if ((dealId && contactId) || (!dealId && !contactId)) {
    notFound();
  }

  const supabase = await createClient();

  let context: TaskContext;
  let cancelHref: string;
  let descriptionNode: React.ReactNode;
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
    descriptionNode = (
      <>
        Attached to deal <span className="font-semibold text-ink-900">{deal.title}</span>.
      </>
    );
    breadcrumbs = [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Deals", href: "/dashboard/deals" },
      { label: deal.title, href: `/dashboard/deals/${deal.id}` },
      { label: "New task" },
    ];
  } else {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, name")
      .eq("id", contactId!)
      .maybeSingle();
    if (!contact) notFound();
    context = { kind: "contact", contactId: contact.id };
    cancelHref = `/dashboard/contacts/${contact.id}`;
    descriptionNode = (
      <>
        Attached to contact <span className="font-semibold text-ink-900">{contact.name}</span>.
      </>
    );
    breadcrumbs = [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Contacts", href: "/dashboard/contacts" },
      { label: contact.name, href: `/dashboard/contacts/${contact.id}` },
      { label: "New task" },
    ];
  }

  // Assignees: anyone active. PM candidates: only admin/pm — these are the
  // roles allowed to own a standalone task per the RLS policies in 0011.
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

  return (
    <Page>
      <Breadcrumbs trail={breadcrumbs} />
      <FormCard title="New task" subtitle={descriptionNode}>
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
