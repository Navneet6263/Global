import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { CandidateChecks } from "@/components/candidate/CandidateChecks";
import { CandidateDocuments } from "@/components/candidate/CandidateDocuments";
import { CandidateOverview } from "@/components/candidate/CandidateOverview";
import { CandidateBrand, CandidateUnavailable } from "@/components/candidate/candidate-ui";
import { getCandidatePortal } from "@/lib/api/candidate-portal";

export const Route = createFileRoute("/candidate/$accessId")({
  component: CandidatePortalPage,
  head: () => ({ meta: [{ title: "Candidate workspace — Sapling Global" }] }),
});

function CandidatePortalPage() {
  const { accessId } = Route.useParams();
  const [token, setToken] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    setToken(params.get("token") ?? "");
  }, []);
  const portal = useQuery({
    queryKey: ["candidate-portal", accessId, token],
    queryFn: () => getCandidatePortal(accessId, token),
    enabled: Boolean(token),
    retry: false,
  });
  const data = portal.data?.case;
  return (
    <main className="min-h-screen bg-white px-4 py-8 text-foreground sm:py-14">
      <div className="mx-auto max-w-4xl">
        <CandidateBrand />
        {!token ? (
          <CandidateUnavailable message="The secure access token is missing from this link." />
        ) : null}
        {portal.isLoading ? <div className="surface h-96 animate-pulse rounded-[2rem]" /> : null}
        {portal.isError ? <CandidateUnavailable message={portal.error.message} /> : null}
        {portal.data && data ? (
          <div className="space-y-5">
            <CandidateOverview data={data} expiresAt={portal.data.expiresAt} />
            <div className="grid items-start gap-5 lg:grid-cols-[1.1fr_0.9fr]">
              <CandidateChecks accessId={accessId} token={token} data={data} />
              <CandidateDocuments accessId={accessId} token={token} documents={data.documents} />
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
