import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  OpsOnboardingBoard,
  type OnboardingSearch,
} from "@/features/onboarding/OpsOnboardingBoard";
import { parseOnboardingSearch } from "@/features/onboarding/onboarding-search";
import { getSession } from "@/lib/api/auth";

export const Route = createFileRoute("/operations/onboarding")({
  validateSearch: parseOnboardingSearch,
  head: () => ({ meta: [{ title: "Company onboarding — Sapling Global Operations" }] }),
  component: OnboardingPage,
});

function OnboardingPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const onChange = useCallback(
    (patch: Partial<OnboardingSearch>) =>
      void navigate({ search: (current) => ({ ...current, ...patch }), resetScroll: false }),
    [navigate],
  );
  return (
    <>
      <header className="client-heading">
        <div>
          <h1>Company onboarding</h1>
          <p>
            Every company in one place, whether it registered itself or you added it. Set its RM,
            documents and packages, then approve it to go live.
          </p>
        </div>
      </header>
      <OpsOnboardingBoard
        search={search}
        onChange={onChange}
        canAssignRm={
          Boolean(session.data?.roles.includes("OPS_MANAGER")) && !session.data?.viewOnly
        }
      />
    </>
  );
}
