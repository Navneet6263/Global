import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { CandidateUploadPage } from "@/components/candidate/CandidateUploadPage";
import { PublicPageShell } from "@/features/public/PublicPageShell";
import { CandidateSupportSheet } from "@/features/support/components/CandidateSupportSheet";
import { PublicLoading, PublicUnavailable } from "@/features/public/PublicStates";
import { getCandidatePortal } from "@/lib/api/candidate-portal";
import { capturePublicLinkToken } from "@/lib/auth/public-link-token";

export const Route = createFileRoute("/candidate/$accessId")({
  component: CandidatePortalPage,
  head: () => ({ meta: [{ title: "Upload your documents — Sapling Global" }] }),
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
    <PublicPageShell
      context="Secure document upload"
      actions={
        data && !portal.data?.completedAt ? (
          <CandidateSupportSheet
            accessId={accessId}
            token={accessToken}
            requests={data.supportRequests}
          />
        ) : null
      }
    >
      {token === null ? <PublicLoading /> : null}
      {token === "" ? (
        <PublicUnavailable
          title="This link is incomplete"
          message="Open the full link from your email. If it still does not work, ask the company that requested your verification to resend it."
        />
      ) : null}
      {portal.isLoading ? <PublicLoading /> : null}
      {portal.isError ? (
        <PublicUnavailable
          title="This link is no longer active"
          message="It may have expired or been replaced by a newer link. Please use the most recent link we emailed you."
          onRetry={() => void portal.refetch()}
        />
      ) : null}
      {portal.data && data ? (
        <CandidateUploadPage accessId={accessId} token={accessToken} portal={portal.data} />
      ) : null}
    </PublicPageShell>
  );
}
