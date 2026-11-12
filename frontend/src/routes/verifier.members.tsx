import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/layout/page-header";
import { TeamMembers } from "@/features/workflow-ui/TeamMembers";
import { validateVerifierDepartmentSearch } from "@/lib/auth/verifier-department";

export const Route = createFileRoute("/verifier/members")({
  head: () => ({ meta: [{ title: "Team members — Sapling Global" }] }),
  validateSearch: validateVerifierDepartmentSearch,
  component: Page,
});

function Page() {
  return (
    <div className="grid gap-5">
      <PageHeader
        title="Team members"
        description="Add logins for your team, reset passwords and suspend access."
      />
      <TeamMembers />
    </div>
  );
}
