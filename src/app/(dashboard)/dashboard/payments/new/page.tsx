import { Page, PageHeader } from "@/components/page-shell";
import {
  RecordPaymentForm,
  type PaymentContextOption,
} from "@/components/payments/record-payment-form";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

// Role gating happens upstream in
// app/(dashboard)/dashboard/payments/layout.tsx → guardSection("payments").

export default async function NewPaymentPage() {
  const supabase = await createClient();

  // Pull eligible contexts in parallel. We only need id + name + company_id
  // from each. company_id is what makes the context picker work — the user
  // never picks a company manually; we derive it from the chosen entity.
  // Rows where company_id is somehow null are filtered out client-side
  // (shouldn't happen — both tables NOT NULL company_id — but defensive).
  const [{ data: projects }, { data: deals }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, company_id")
      .order("name", { ascending: true }),
    supabase
      .from("deals")
      .select("id, title, company_id")
      .order("created_at", { ascending: false }),
  ]);

  const options: PaymentContextOption[] = [
    ...(projects ?? [])
      .filter((p) => !!p.company_id)
      .map<PaymentContextOption>((p) => ({
        kind: "project",
        id: p.id,
        label: p.name,
        companyId: p.company_id as string,
      })),
    ...(deals ?? [])
      .filter((d) => !!d.company_id)
      .map<PaymentContextOption>((d) => ({
        kind: "deal",
        id: d.id,
        label: d.title,
        companyId: d.company_id as string,
      })),
  ];

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payments", href: "/dashboard/payments" },
          { label: "Record payment" },
        ]}
        title="Record payment"
        description="Pick the project or deal this payment is against. The company is derived from your choice."
      />
      <Card className="w-full max-w-[720px]">
        <CardContent className="pt-6">
          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No projects or deals available to attach a payment to. Create one
              first.
            </p>
          ) : (
            <RecordPaymentForm
              mode="picker"
              options={options}
              // Revalidate the list so the new row appears, and redirect there
              // so the user lands on the payment they just recorded.
              revalidatePath="/dashboard/payments"
              redirectTo="/dashboard/payments"
            />
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
