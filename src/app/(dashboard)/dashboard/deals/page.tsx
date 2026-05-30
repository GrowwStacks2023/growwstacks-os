import Link from "next/link";

import { Page, PageHeader } from "@/components/page-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canCreate, canEdit } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { createClient } from "@/lib/supabase/server";

import { type DealCard } from "./deals-board";
import { DealsView } from "./deals-view";

export default async function DealsPage() {
  const role = await getCurrentRole();
  const mayCreate = canCreate(role, "deal");
  const mayEdit = canEdit(role, "deal");
  const supabase = await createClient();
  const { data: deals, error } = await supabase
    .from("deals")
    .select(
      "id, title, stage, source, value_inr, value_usd, company:companies(name), owner:users(name, email)"
    )
    .order("created_at", { ascending: false });

  const rows: DealCard[] = (deals ?? []) as DealCard[];

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Deals" },
        ]}
        title="Deals"
        description="Sales pipeline. Drag a card across columns to move it forward, or switch to List for a flat view."
        action={
          mayCreate ? (
            <Button render={<Link href="/dashboard/deals/new" />}>
              New deal
            </Button>
          ) : null
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            Couldn&apos;t load deals: {error.message}
          </AlertDescription>
        </Alert>
      ) : null}

      {rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No deals yet</CardTitle>
            <CardDescription>
              The pipeline is empty. Add your first opportunity to start
              filling the columns.
            </CardDescription>
          </CardHeader>
          {mayCreate ? (
            <CardContent>
              <Button render={<Link href="/dashboard/deals/new" />}>
                Create deal
              </Button>
            </CardContent>
          ) : null}
        </Card>
      ) : (
        <DealsView deals={rows} canDrag={mayEdit} />
      )}
    </Page>
  );
}
