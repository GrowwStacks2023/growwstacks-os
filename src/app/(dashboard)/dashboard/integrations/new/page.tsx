import { Breadcrumbs, Page } from "@/components/page-shell";
import { FormCard } from "@/components/form";

import { NewKeyForm } from "./new-key-form";

export default function NewKeyPage() {
  return (
    <Page>
      <Breadcrumbs
        trail={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Integrations", href: "/dashboard/integrations" },
          { label: "Generate key" },
        ]}
      />
      <FormCard
        title="Generate API key"
        subtitle="Name the key (e.g. 'n8n integration') and pick a scope. We'll show the key once — copy it into your password manager immediately."
      >
        <NewKeyForm />
      </FormCard>
    </Page>
  );
}
