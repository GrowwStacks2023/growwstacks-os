import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function CompaniesPage() {
  const supabase = await createClient();
  const { data: companies, error } = await supabase
    .from("companies")
    .select("id, name, type, timezone, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-medium">Companies</h1>
          <p className="text-sm text-muted-foreground">
            Clients, prospects, and partners.
          </p>
        </div>
        <Button render={<Link href="/dashboard/companies/new" />}>
          New company
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>
            Couldn&apos;t load companies: {error.message}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        {!companies || companies.length === 0 ? (
          <>
            <CardHeader>
              <CardTitle className="text-base">No companies yet</CardTitle>
              <CardDescription>
                No companies yet. Create your first one.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button render={<Link href="/dashboard/companies/new" />}>
                Create company
              </Button>
            </CardContent>
          </>
        ) : (
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Timezone</TableHead>
                  <TableHead className="pr-4">Created at</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="pl-4 font-medium">
                      <Link
                        href={`/dashboard/companies/${company.id}`}
                        className="hover:underline"
                      >
                        {company.name}
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {company.type}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {company.timezone}
                    </TableCell>
                    <TableCell className="pr-4 text-muted-foreground">
                      {dateFormatter.format(new Date(company.created_at))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
