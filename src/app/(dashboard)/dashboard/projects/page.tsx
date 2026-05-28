import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ProjectsPage() {
  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-[480px]">
        <CardHeader>
          <CardTitle className="text-base">Projects</CardTitle>
          <CardDescription>Coming soon.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
