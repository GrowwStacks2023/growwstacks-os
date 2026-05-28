import { PageLoader } from "@/components/page-shell";

// Inherits to every /dashboard/* route segment that doesn't have its own
// loading.tsx. Next renders this instantly on navigation while the server
// component on the other side is still fetching. Wraps all the sub-routes:
// dashboard home, companies (list/detail/new), contacts, deals, projects,
// tasks, payments.
export default function Loading() {
  return <PageLoader label="Loading…" />;
}
