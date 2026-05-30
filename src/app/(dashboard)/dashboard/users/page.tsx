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

import {
  DeactivateButton,
  DeleteUserButton,
  ReactivateButton,
} from "./activation-buttons";
import { ResendInviteButton } from "./resend-invite-button";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ show_deleted?: string }>;
}) {
  // Layout already enforces admin via guardSection("users").
  const params = await searchParams;
  const showDeleted = params.show_deleted === "1";

  const supabase = await createClient();

  let query = supabase
    .from("users")
    .select(
      "id, name, email, role, is_active, created_at, deactivated_at, deleted_at"
    );
  if (!showDeleted) {
    query = query.is("deleted_at", null);
  }

  const { data: users, error } = await query
    .order("deleted_at", { ascending: true, nullsFirst: true })
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
        description="Invite teammates, set their roles, deactivate when they pause, delete when they leave. Invites are emailed by Supabase — new users set their own password via the link."
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={showDeleted ? "secondary" : "outline"}
              render={
                <Link
                  href={
                    showDeleted
                      ? "/dashboard/users"
                      : "/dashboard/users?show_deleted=1"
                  }
                />
              }
            >
              {showDeleted ? "Hide former" : "Show former"}
            </Button>
            <Button render={<Link href="/dashboard/users/new" />}>
              Invite user
            </Button>
          </div>
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
                const tombstoned = u.deleted_at != null;
                const label = u.name?.trim() || u.email;
                return (
                  <TableRow
                    key={u.id}
                    className={
                      tombstoned
                        ? "opacity-50"
                        : u.is_active
                          ? ""
                          : "opacity-60"
                    }
                  >
                    <TableCell className="pl-6 font-semibold text-ink-900">
                      {u.email}
                      {tombstoned ? (
                        <span className="ml-1 text-[12px] font-normal text-ink-400">
                          (Former)
                        </span>
                      ) : null}
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
                      {tombstoned ? (
                        <Badge
                          variant="outline"
                          className="bg-[#eef3f8] text-ink-500"
                        >
                          Deleted
                        </Badge>
                      ) : u.is_active ? (
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
                        {tombstoned ? null : u.is_active ? (
                          <>
                            <ResendInviteButton userId={u.id} />
                            <DeactivateButton
                              userId={u.id}
                              userLabel={label}
                            />
                            <DeleteUserButton
                              userId={u.id}
                              userLabel={label}
                            />
                          </>
                        ) : (
                          <>
                            <ReactivateButton userId={u.id} />
                            <DeleteUserButton
                              userId={u.id}
                              userLabel={label}
                            />
                          </>
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
