import { Page, PageHeader } from "@/components/page-shell";
import { Card, CardContent } from "@/components/ui/card";

import { NewCompanyForm } from "./new-company-form";

export default function NewCompanyPage() {
  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Companies", href: "/dashboard/companies" },
          { label: "New company" },
        ]}
        title="New company"
        description="Add a prospect, client, or partner."
      />
      <Card className="w-full max-w-[560px]">
        <CardContent className="pt-6">
          <NewCompanyForm />
        </CardContent>
      </Card>
    </Page>
  );
}
