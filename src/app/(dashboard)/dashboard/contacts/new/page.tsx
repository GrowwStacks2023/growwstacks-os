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

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-[560px]">
        <CardHeader>
          <CardTitle className="text-base">New contact</CardTitle>
          <CardDescription>
            A contact can stand alone or belong to a company.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewContactForm companies={companies ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
