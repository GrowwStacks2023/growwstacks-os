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
import { userDisplay } from "@/lib/display";
import { API_SCOPE } from "@/lib/status-colors";
import { createClient } from "@/lib/supabase/server";

import { RevokeKeyButton } from "./revoke-key-button";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

type Scope = "read" | "read_write";

export default async function IntegrationsPage() {
  // Layout enforces admin via guardSection("integrations").
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("api_keys")
    .select(
      "id, name, key_prefix, scope, created_at, last_used_at, revoked_at, creator:users!api_keys_created_by_fkey(name, email)"
    )
    .order("created_at", { ascending: false });

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Integrations" },
        ]}
        title="Integrations"
        description="API keys for connecting external tools (n8n, Postman, scripts) to your workspace. Keys are shown once on creation — store them in a password manager."
        action={
          <Button render={<Link href="/dashboard/integrations/new" />}>
            Generate key
          </Button>
        }
      />

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            Couldn&apos;t load API keys: {error.message}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Name</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created by</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead className="pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows ?? []).map((row) => {
                const scope = API_SCOPE[row.scope as Scope];
                const revoked = row.revoked_at != null;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="pl-6 font-semibold text-ink-900">
                      {row.name}
                    </TableCell>
                    <TableCell className="font-numeric text-ink-500">
                      {row.key_prefix}…
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={scope.variant}
                        className={scope.className}
                      >
                        {scope.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {revoked ? (
                        <Badge variant="destructive">Revoked</Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-ink-500">
                      {userDisplay(row.creator, "—")}
                    </TableCell>
                    <TableCell className="font-numeric text-ink-500">
                      {dateFormatter.format(new Date(row.created_at))}
                    </TableCell>
                    <TableCell className="font-numeric text-ink-500">
                      {row.last_used_at
                        ? dateFormatter.format(new Date(row.last_used_at))
                        : "—"}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      {revoked ? null : <RevokeKeyButton keyId={row.id} />}
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
