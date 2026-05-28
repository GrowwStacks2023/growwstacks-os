import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function TasksPage() {
  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-[480px]">
        <CardHeader>
          <CardTitle className="text-base">Tasks</CardTitle>
          <CardDescription>Coming soon.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
