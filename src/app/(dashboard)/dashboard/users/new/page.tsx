import { Breadcrumbs, Page } from "@/components/page-shell";
import { FormCard } from "@/components/form";

import { NewUserForm } from "./new-user-form";

export default function NewUserPage() {
  // Layout already enforces admin via guardSection("users").
  return (
    <Page>
      <Breadcrumbs
        trail={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Users", href: "/dashboard/users" },
          { label: "Invite user" },
        ]}
      />
      <FormCard
        title="Invite a teammate"
        subtitle="Supabase emails them a link to set their own password. No passwords are set here — that's by design."
      >
        <NewUserForm />
      </FormCard>
    </Page>
  );
}
