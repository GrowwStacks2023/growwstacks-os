import Link from "next/link";
import { notFound } from "next/navigation";

import { AttachmentsCard } from "@/components/attachments";
import { Page, PageHeader } from "@/components/page-shell";
import { DealPaymentsCard } from "@/components/payments";
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
import { userDisplay } from "@/lib/display";
import {
  DEAL_SOURCE,
  DEAL_STAGE,
  TASK_PRIORITY,
  TASK_STATUS,
} from "@/lib/status-colors";
import { createClient } from "@/lib/supabase/server";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatValue(inr: number | null, usd: number | null): string {
  const parts: string[] = [];
  if (inr && inr > 0) parts.push(inrFormatter.format(Number(inr)));
  if (usd && usd > 0) parts.push(usdFormatter.format(Number(usd)));
  return parts.length === 0 ? "—" : parts.join(" + ");
}

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: deal, error } = await supabase
    .from("deals")
    .select(
      "id, title, description, stage, source, value_inr, value_usd, created_at, won_at, lost_at, lost_reason, company_id, company:companies(id, name), contact:contacts(id, name), owner:users(name, email)"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Couldn&apos;t load deal: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!deal) {
    notFound();
  }

  // Tasks attached to this deal. The assignee join needs the explicit
  // FK-hint because tasks now has two user FKs (assignee_id + pm_id).
  const { data: tasks } = await supabase
    .from("tasks")
    .select(
      "id, title, status, priority, due_at, assignee:users!tasks_assignee_id_fkey(name, email)"
    )
    .eq("deal_id", id)
    .order("created_at", { ascending: false });

  const stage = DEAL_STAGE[deal.stage];
  const source = DEAL_SOURCE[deal.source];
  const ownerDisplay = userDisplay(deal.owner, "Unassigned");

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Deals", href: "/dashboard/deals" },
          { label: deal.title },
        ]}
        title={deal.title}
        description={
          <>
            {deal.company ? (
              <Link
                href={`/dashboard/companies/${deal.company.id}`}
                className="hover:underline"
              >
                {deal.company.name}
              </Link>
            ) : (
              "—"
            )}
            {" · "}Owner: {ownerDisplay}
          </>
        }
        meta={
          <>
            <Badge variant={stage.variant} className={stage.className}>
              {stage.label}
            </Badge>
            <Badge variant={source.variant} className={source.className}>
              {source.label}
            </Badge>
          </>
        }
      />

      <div className="flex flex-col gap-2">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Value:</dt>
            <dd className="font-medium">
              {formatValue(deal.value_inr, deal.value_usd)}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Contact:</dt>
            <dd>{deal.contact?.name ?? "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Created:</dt>
            <dd>{dateFormatter.format(new Date(deal.created_at))}</dd>
          </div>
          {deal.won_at ? (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Won:</dt>
              <dd>{dateFormatter.format(new Date(deal.won_at))}</dd>
            </div>
          ) : null}
          {deal.lost_at ? (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Lost:</dt>
              <dd>{dateFormatter.format(new Date(deal.lost_at))}</dd>
            </div>
          ) : null}
        </dl>
        {deal.lost_reason ? (
          <p className="text-sm text-muted-foreground">
            Lost reason: {deal.lost_reason}
          </p>
        ) : null}
        {deal.description ? (
          <p className="mt-2 max-w-2xl text-sm text-foreground/90">
            {deal.description}
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">Tasks</CardTitle>
              <CardDescription>
                Standalone tasks attached to this deal.
              </CardDescription>
            </div>
            <Button
              size="sm"
              render={
                <Link href={`/dashboard/tasks/new?deal=${deal.id}`} />
              }
            >
              Add task
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!tasks || tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tasks yet. Add one to start a follow-up.
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

      <DealPaymentsCard
        dealId={deal.id}
        companyId={deal.company_id}
        expectedInr={deal.value_inr}
        expectedUsd={deal.value_usd}
        revalidatePath={`/dashboard/deals/${deal.id}`}
      />

      <AttachmentsCard
        entityType="deal"
        entityId={deal.id}
        revalidatePath={`/dashboard/deals/${deal.id}`}
      />
    </Page>
  );
}
