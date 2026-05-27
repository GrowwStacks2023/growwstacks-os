import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("name, email, role")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.name ?? profile?.email ?? user.email ?? "there";
  const role = profile?.role ?? "unknown";

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Welcome, {displayName}</CardTitle>
          <CardDescription>
            Your role:{" "}
            <span className="font-medium text-foreground">{role}</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This is a placeholder dashboard. Real content will land in later
            tasks.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
