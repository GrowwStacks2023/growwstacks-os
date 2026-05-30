import Link from "next/link";

import { Page, PageHeader } from "@/components/page-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { USER_ROLE } from "@/lib/status-colors";
import { createClient } from "@/lib/supabase/server";

import { DeactivateButton, ReactivateButton } from "./activation-buttons";
import { ResendInviteButton } from "./resend-invite-button";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function UsersPage() {
  // Layout already enforces admin via guardSection("users").
  const supabase = await createClient();
  const { data: users, error } = await supabase
    .from("users")
    .select("id, name, email, role, is_active, created_at, deactivated_at")
    // Active users first; within each group newest at top.
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Users" },
        ]}
        title="Team"
        description="Invite teammates, set their roles, deactivate when they leave. Invites are emailed by Supabase — new users set their own password via the link."
        action={
          <Button render={<Link href="/dashboard/users/new" />}>
            Invite user
          </Button>
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            Couldn&apos;t load users: {error.message}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users ?? []).map((u) => {
                const roleVisual = USER_ROLE[u.role];
                const label = u.name?.trim() || u.email;
                return (
                  <TableRow
                    key={u.id}
                    className={u.is_active ? "" : "opacity-60"}
                  >
                    <TableCell className="pl-6 font-semibold text-ink-900">
                      {u.email}
                    </TableCell>
                    <TableCell className="text-ink-500">
                      {u.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={roleVisual.variant}
                        className={roleVisual.className}
                      >
                        {roleVisual.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {u.is_active ? (
                        <Badge
                          variant="outline"
                          className="bg-green-100 text-green-700"
                        >
                          Active
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="bg-[#eef3f8] text-ink-500"
                        >
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-numeric text-ink-500">
                      {dateFormatter.format(new Date(u.created_at))}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.is_active ? (
                          <>
                            <ResendInviteButton userId={u.id} />
                            <DeactivateButton
                              userId={u.id}
                              userLabel={label}
                            />
                          </>
                        ) : (
                          <ReactivateButton userId={u.id} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Page>
  );
}
