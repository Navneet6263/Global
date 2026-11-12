import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { UtvBucket } from "@/features/workflow-ui/UtvBucket";
import { validateVerifierDepartmentSearch } from "@/lib/auth/verifier-department";

export const Route = createFileRoute("/verifier/utv")({
  head: () => ({ meta: [{ title: "UTV bucket — Sapling Global" }] }),
  validateSearch: validateVerifierDepartmentSearch,
  component: Page,
});

function Page() {
  return (
    <div className="grid gap-5">
      <PageHeader
        title="UTV bucket"
        description="Checks closed as unable to verify. Team Leaders can re-open or re-initiate them."
      />
      <UtvBucket />
    </div>
  );
}
