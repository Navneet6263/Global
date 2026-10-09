import { useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  OpsOnboardingBoard,
  type OnboardingSearch,
} from "@/features/onboarding/OpsOnboardingBoard";
import { parseOnboardingSearch } from "@/features/onboarding/onboarding-search";
import { PageHeader } from "@/components/layout/page-header";

export const Route = createFileRoute("/admin/onboarding")({
  validateSearch: parseOnboardingSearch,
  head: () => ({ meta: [{ title: "Company sign-ups — Sapling Global" }] }),
  component: AdminOnboardingPage,
});

/** Platform Admin oversight of self sign-ups: read-only; Operations approves. */
function AdminOnboardingPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const onChange = useCallback(
    (patch: Partial<OnboardingSearch>) =>
      void navigate({ search: (current) => ({ ...current, ...patch }), resetScroll: false }),
    [navigate],
  );
  return (
    <>
      <PageHeader
        title="Company sign-ups"
        description="Self-registered companies, their documents and Operations decisions. View only."
      />
      <OpsOnboardingBoard search={search} onChange={onChange} canAssignRm={false} />
    </>
  );
}
