import { useCallback } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  OpsOnboardingBoard,
  type OnboardingSearch,
} from "@/features/onboarding/OpsOnboardingBoard";
import { parseOnboardingSearch } from "@/features/onboarding/onboarding-search";

export const Route = createFileRoute("/spoc-rm/onboarding")({
  validateSearch: parseOnboardingSearch,
  head: () => ({ meta: [{ title: "Onboarding companies — Sapling Global RM" }] }),
  component: RmOnboardingPage,
});

function RmOnboardingPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const onChange = useCallback(
    (patch: Partial<OnboardingSearch>) =>
      void navigate({ search: (current) => ({ ...current, ...patch }), resetScroll: false }),
    [navigate],
  );
  return (
    <>
      <header className="client-heading">
        <div>
          <h1>Onboarding companies</h1>
          <p>
            Self sign-up companies assigned to you. Review their documents, choose packages and
            approve them yourself.
          </p>
        </div>
      </header>
      <OpsOnboardingBoard search={search} onChange={onChange} canAssignRm={false} />
    </>
  );
}
