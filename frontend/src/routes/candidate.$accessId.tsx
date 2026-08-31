import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { CandidateChecks } from "@/components/candidate/CandidateChecks";
import { CandidateDocuments } from "@/components/candidate/CandidateDocuments";
import { CandidateOverview } from "@/components/candidate/CandidateOverview";
import { PublicPageShell } from "@/features/public/PublicPageShell";
import { PublicLoading, PublicUnavailable } from "@/features/public/PublicStates";
import { getCandidatePortal } from "@/lib/api/candidate-portal";
import { capturePublicLinkToken } from "@/lib/auth/public-link-token";

export const Route = createFileRoute("/candidate/$accessId")({
  component: CandidatePortalPage,
  head: () => ({ meta: [{ title: "Candidate workspace — Sapling Global" }] }),
});

function CandidatePortalPage() {
  const { accessId } = Route.useParams();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    setToken(capturePublicLinkToken(`candidate:${accessId}`));
  }, [accessId]);
  const accessToken = token ?? "";
  const portal = useQuery({
    queryKey: ["candidate-portal", accessId, accessToken],
    queryFn: () => getCandidatePortal(accessId, accessToken),
    enabled: Boolean(accessToken),
    retry: false,
  });
  const data = portal.data?.case;
  return (
    <PublicPageShell context="Secure candidate workspace">
      <div className="mx-auto max-w-5xl">
        {token === null ? <PublicLoading /> : null}
        {token === "" ? (
          <PublicUnavailable
            title="Candidate link is unavailable"
            message="The secure access token is missing from this link."
          />
        ) : null}
        {portal.isLoading ? <PublicLoading /> : null}
        {portal.isError ? (
          <PublicUnavailable
            title="Candidate link is unavailable"
            message={portal.error.message}
            onRetry={() => void portal.refetch()}
          />
        ) : null}
        {portal.data && data ? (
          <div className="space-y-5">
            <CandidateOverview data={data} expiresAt={portal.data.expiresAt} />
            <div className="grid items-start gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <CandidateChecks accessId={accessId} token={accessToken} data={data} />
              <CandidateDocuments
                accessId={accessId}
                token={accessToken}
                caseStatus={data.status}
                documents={data.documents}
              />
            </div>
          </div>
        ) : null}
      </div>
    </PublicPageShell>
  );
}
