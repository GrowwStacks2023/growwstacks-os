import { notFound, redirect } from "next/navigation";

import { Breadcrumbs, Page } from "@/components/page-shell";
import { FormCard } from "@/components/form";
import { canEdit } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { createClient } from "@/lib/supabase/server";

import { EditCompanyForm } from "./edit-company-form";

// Trim a "HH:MM:SS" timestamp string down to "HH:MM" so it can pre-fill
// an <input type="time"> without surprising the browser. Server-side
// (Postgres) keeps the seconds; the UI just hides them.
function timeForInput(value: string | null): string {
  if (!value) return "";
  const m = /^(\d{2}:\d{2})/.exec(value);
  return m ? m[1] : "";
}

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const role = await getCurrentRole();
  // Belt-and-suspenders: the section layout already runs guardSection
  // for "companies", but it doesn't enforce edit specifically. If
  // somebody who can read companies (e.g. sales) navigates to /edit, we
  // bounce them back to the detail page rather than letting the action
  // reject after the form submits.
  if (!canEdit(role, "company")) {
    redirect(`/dashboard/companies/${id}`);
  }

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select(
      "id, name, type, timezone, business_hours_start, business_hours_end"
    )
    .eq("id", id)
    .maybeSingle();

  if (!company) notFound();

  return (
    <Page>
      <Breadcrumbs
        trail={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Companies", href: "/dashboard/companies" },
          {
            label: company.name,
            href: `/dashboard/companies/${company.id}`,
          },
          { label: "Edit" },
        ]}
      />
      <FormCard
        title={`Edit ${company.name}`}
        subtitle="Update the company record. Changes are logged to the activity feed."
      >
        <EditCompanyForm
          company={{
            id: company.id,
            name: company.name,
            type: company.type,
            timezone: company.timezone,
            businessHoursStart: timeForInput(company.business_hours_start),
            businessHoursEnd: timeForInput(company.business_hours_end),
          }}
        />
      </FormCard>
    </Page>
  );
}
