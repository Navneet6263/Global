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
  head: () => ({ meta: [{ title: "Company onboarding — Sapling Global" }] }),
  component: AdminOnboardingPage,
});

/** Platform Admin sets up companies (details, documents, packages, RM); Operations approves. */
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
        title="Company onboarding"
        description="Set up every company here: details, documents, packages and RM. Operations or the company's RM approves it."
      />
      <OpsOnboardingBoard search={search} onChange={onChange} canAssignRm />
    </>
  );
}
