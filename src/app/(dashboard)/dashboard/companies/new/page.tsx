import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { NewCompanyForm } from "./new-company-form";

export default function NewCompanyPage() {
  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-[480px]">
        <CardHeader>
          <CardTitle className="text-base">New company</CardTitle>
          <CardDescription>
            Add a prospect, client, or partner.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewCompanyForm />
        </CardContent>
      </Card>
    </div>
  );
}
