import { Breadcrumbs, Page } from "@/components/page-shell";
import { FormCard } from "@/components/form";

import { NewCompanyForm } from "./new-company-form";

export default function NewCompanyPage() {
  return (
    <Page>
      <Breadcrumbs
        trail={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Companies", href: "/dashboard/companies" },
          { label: "New company" },
        ]}
      />
      <FormCard
        title="New company"
        subtitle="Add a prospect, client, or partner. You can attach contacts, deals, and files after creating the company."
      >
        <NewCompanyForm />
      </FormCard>
    </Page>
  );
}
