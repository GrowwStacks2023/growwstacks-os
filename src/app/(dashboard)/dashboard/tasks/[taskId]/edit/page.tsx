import { notFound, redirect } from "next/navigation";

import { Breadcrumbs, Page } from "@/components/page-shell";
import { FormCard } from "@/components/form";
import { canEdit, canEditOwnTaskOnly } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { createClient } from "@/lib/supabase/server";

import { EditTaskForm } from "./edit-task-form";
import { EditTaskStatusForm } from "./edit-task-status-form";

// Convert timestamptz to YYYY-MM-DD for <input type="date">. Same as the
// other edit forms — keep the form trivially typed and let the action
// re-normalise on submit.
function dateForInput(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  const role = await getCurrentRole();
  const supabase = await createClient();

  // Fetch the task first — we need it both for the access check and to
  // populate the form. Same select shape as the detail page so a missing
  // RLS read also surfaces as "not found".
  const { data: task } = await supabase
    .from("tasks")
    .select(
      "id, title, description, status, priority, assignee_id, pm_id, estimate_hours, due_at, project_id, milestone_id, deal_id, contact_id, project:projects(id, name), milestone:milestones(id, name, sequence), deal:deals(id, title), contact:contacts(id, name)"
    )
    .eq("id", taskId)
    .maybeSingle();

  if (!task) notFound();

  // Access matrix:
  //   admin/pm  → full edit form (canEdit task = true)
  //   developer → status-only form (canEditOwnTaskOnly + must be assignee)
  //   sales/client → bounced
  const detailHref = `/dashboard/tasks/${task.id}`;
  if (!canEdit(role, "task") && !canEditOwnTaskOnly(role)) {
    redirect(detailHref);
  }

  // Developer must be the assignee. We do this server-side here so a
  // developer who manually navigates to /edit for a teammate's task gets
  // bounced cleanly back to the detail page rather than landing on a
  // form that the action would later refuse.
  if (canEditOwnTaskOnly(role) && !canEdit(role, "task")) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || task.assignee_id !== user.id) {
      redirect(detailHref);
    }
  }

  // Build the breadcrumb trail matching the detail page so context stays
  // identical between view + edit.
  const breadcrumbs: Array<{ label: string; href?: string }> = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Tasks", href: "/dashboard/tasks" },
  ];
  let subtitle = "Standalone task";
  if (task.milestone && task.project) {
    breadcrumbs.push(
      {
        label: task.project.name,
        href: `/dashboard/projects/${task.project.id}`,
      },
      {
        label: `#${task.milestone.sequence} ${task.milestone.name}`,
        href: `/dashboard/projects/${task.project.id}/milestones/${task.milestone.id}`,
      }
    );
    subtitle = `${task.project.name} · ${task.milestone.name}`;
  } else if (task.project) {
    breadcrumbs.push({
      label: task.project.name,
      href: `/dashboard/projects/${task.project.id}`,
    });
    subtitle = `Project: ${task.project.name}`;
  } else if (task.deal) {
    breadcrumbs.push({
      label: task.deal.title,
      href: `/dashboard/deals/${task.deal.id}`,
    });
    subtitle = `Deal: ${task.deal.title}`;
  } else if (task.contact) {
    breadcrumbs.push({
      label: task.contact.name,
      href: `/dashboard/contacts/${task.contact.id}`,
    });
    subtitle = `Contact: ${task.contact.name}`;
  }
  breadcrumbs.push({
    label: task.title,
    href: detailHref,
  });
  breadcrumbs.push({ label: "Edit" });

  // Branch on the role. Developer flow gets a minimal status-only form;
  // admin/pm get the full form and the people pickers behind it.
  if (canEditOwnTaskOnly(role) && !canEdit(role, "task")) {
    return (
      <Page>
        <Breadcrumbs trail={breadcrumbs} />
        <FormCard
          title={`Edit ${task.title}`}
          subtitle={
            <>
              {subtitle} · You can update the status of your own tasks. Full
              edits require an admin or PM.
            </>
          }
        >
          <EditTaskStatusForm
            taskId={task.id}
            currentStatus={task.status}
            detailHref={detailHref}
          />
        </FormCard>
      </Page>
    );
  }

  // Admin / PM — full edit. Pull assignee + PM pickers (same shape used
  // by the create form).
  const [assigneesRes, pmRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, name, email")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("users")
      .select("id, name, email")
      .in("role", ["admin", "pm"])
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
  ]);

  return (
    <Page>
      <Breadcrumbs trail={breadcrumbs} />
      <FormCard
        title={`Edit ${task.title}`}
        subtitle={<>Task · {subtitle}</>}
      >
        <EditTaskForm
          task={{
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            assigneeId: task.assignee_id,
            pmId: task.pm_id,
            estimateHours: task.estimate_hours,
            dueAt: dateForInput(task.due_at),
          }}
          assignees={assigneesRes.data ?? []}
          pmCandidates={pmRes.data ?? []}
          detailHref={detailHref}
        />
      </FormCard>
    </Page>
  );
}
