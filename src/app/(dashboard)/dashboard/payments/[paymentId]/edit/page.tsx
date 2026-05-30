import { notFound, redirect } from "next/navigation";

import { Breadcrumbs, Page } from "@/components/page-shell";
import { FormCard } from "@/components/form";
import { canEdit } from "@/lib/access";
import { getCurrentRole } from "@/lib/access-server";
import { createClient } from "@/lib/supabase/server";

import { EditPaymentForm } from "./edit-payment-form";

// Render a datetime for an <input type="datetime-local"> (16 chars, no tz).
// We use local time so the form round-trips smoothly; updatePayment
// normalises the string back to ISO on save.
function timestampForInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditPaymentPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const role = await getCurrentRole();
  if (!canEdit(role, "payment")) {
    redirect("/dashboard/payments");
  }

  const supabase = await createClient();
  // Fetch the payment alongside its project + deal labels so the form
  // can show context (and so the breadcrumb can name what's being edited
  // without an extra query). The project/deal/company links are
  // read-only — see updatePayment's flag.
  const { data: payment } = await supabase
    .from("payments")
    .select(
      "id, amount, currency, kind, status, received_at, reference, note, project_id, deal_id, company_id, project:projects(name), deal:deals(title), company:companies(name)"
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment) notFound();

  const contextLabel = payment.project
    ? `Project · ${payment.project.name}`
    : payment.deal
      ? `Deal · ${payment.deal.title}`
      : "—";

  return (
    <Page>
      <Breadcrumbs
        trail={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payments", href: "/dashboard/payments" },
          { label: "Edit payment" },
        ]}
      />
      <FormCard
        title="Edit payment"
        subtitle={
          <>
            {contextLabel}
            {payment.company ? <> · {payment.company.name}</> : null}
            <br />
            <span className="text-[12px] text-ink-500">
              Project / deal / recorder cannot be reassigned. Void and recreate
              the payment if it needs to move.
            </span>
          </>
        }
      >
        <EditPaymentForm
          payment={{
            id: payment.id,
            amount: Number(payment.amount),
            currency: payment.currency,
            kind: payment.kind,
            status: payment.status,
            receivedAt: timestampForInput(payment.received_at),
            reference: payment.reference,
            note: payment.note,
          }}
        />
      </FormCard>
    </Page>
  );
}
