import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

import { NewContactForm } from "./new-contact-form";

export default async function NewContactPage() {
  const supabase = await createClient();
  const { data: companies } = await supabase
    .from("companies")
    .select("id, name")
    .order("name", { ascending: true });

  const hasCompanies = (companies?.length ?? 0) > 0;

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-[480px]">
        <CardHeader>
          <CardTitle className="text-base">New contact</CardTitle>
          <CardDescription>
            Add a person at one of your companies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasCompanies ? (
            <NewContactForm companies={companies ?? []} />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Create a company first — every contact has to belong to one.
              </p>
              <div>
                <Button render={<Link href="/dashboard/companies/new" />}>
                  Create company
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
