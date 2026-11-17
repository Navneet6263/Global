import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { BadgeCheck, Search } from "lucide-react";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { ProgressRing } from "@/features/onboarding/onboarding-ui";
import { getOpsVendorList } from "@/features/vendor-onboarding/api/vendor-onboarding-api";
import { OpsVendorReviewDrawer } from "@/features/vendor-onboarding/components/OpsVendorReviewDrawer";

export const Route = createFileRoute("/operations/vendor-onboarding")({
  head: () => ({ meta: [{ title: "Vendor Onboarding Review — Sapling Global" }] }),
  beforeLoad: () => requireRoleWorkspace(["OPS_MANAGER", "PLATFORM_ADMIN"]),
  component: OpsVendorOnboardingPage,
});

export function OpsVendorOnboardingPage() {
  const [status, setStatus] = useState("PENDING_REVIEW");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchText.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  const query = useQuery({
    queryKey: ["ops-vendor-list", status, debouncedSearch],
    queryFn: () => getOpsVendorList(status, debouncedSearch),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const data = query.data;
  const vendors = data?.items ?? [];
  const counts = data?.counts;

  const tiles = [
    {
      id: "PENDING_REVIEW",
      label: "Ready for review",
      count: counts?.pendingReview,
      tone: "is-info",
    },
    { id: "PENDING_UPLOAD", label: "Still filling in", count: counts?.pendingUpload, tone: "" },
    { id: "APPROVED", label: "Approved vendors", count: counts?.approved, tone: "" },
    { id: "REJECTED", label: "Rejected", count: counts?.rejected, tone: "is-warn" },
  ];

  return (
    <>
      <header className="client-heading">
        <div>
          <h1>Vendor onboarding</h1>
          <p>
            Review self-registered vendor businesses, verify compliance documents, and approve
            access to the vendor workspace.
          </p>
        </div>
      </header>

      <div className="onb-kpis" role="group" aria-label="Filter vendor sign-ups">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            className={`onb-kpi ${tile.tone}`}
            aria-pressed={status === tile.id}
            onClick={() => setStatus(tile.id)}
          >
            <span>{tile.label}</span>
            <strong className="num">{tile.count ?? "—"}</strong>
          </button>
        ))}
      </div>

      <section className="client-panel mt-4" aria-label="Signed-up vendors">
        <header className="client-queue-heading">
          <div className="ops-segment" role="group" aria-label="Status">
            {[
              {
                id: "PENDING_REVIEW",
                label: `Pending Review${counts?.pendingReview ? ` (${counts.pendingReview})` : ""}`,
              },
              {
                id: "PENDING_UPLOAD",
                label: `Draft${counts?.pendingUpload ? ` (${counts.pendingUpload})` : ""}`,
              },
              {
                id: "APPROVED",
                label: `Approved${counts?.approved ? ` (${counts.approved})` : ""}`,
              },
              {
                id: "REJECTED",
                label: `Rejected${counts?.rejected ? ` (${counts.rejected})` : ""}`,
              },
              { id: "ALL", label: `All${counts?.all ? ` (${counts.all})` : ""}` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={status === tab.id}
                onClick={() => setStatus(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form
            className="client-queue-search ops-inline-search"
            onSubmit={(e) => {
              e.preventDefault();
              setDebouncedSearch(searchText.trim());
            }}
          >
            <input
              type="search"
              value={searchText}
              maxLength={80}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search vendor businesses…"
              aria-label="Search vendors"
            />
            <button type="submit" aria-label="Search">
              <Search aria-hidden />
            </button>
          </form>
        </header>

        {query.isPending ? (
          <ListSkeleton rows={5} />
        ) : query.isError ? (
          <ErrorState
            title="Vendor list could not load"
            description={query.error.message}
            onRetry={() => void query.refetch()}
          />
        ) : vendors.length > 0 ? (
          <ul className="onb-board-list" aria-label="Vendor businesses">
            {vendors.map((vendor) => {
              const isApproved = vendor.verificationStatus === "APPROVED";
              const isPending = vendor.verificationStatus === "PENDING_REVIEW";
              const isRejected = vendor.verificationStatus === "REJECTED";
              const percent = isApproved
                ? 100
                : isPending
                  ? 75
                  : vendor.verifiedDocumentsCount > 0
                    ? 50
                    : vendor.documentsCount > 0
                      ? 25
                      : 10;

              return (
                <li key={vendor.publicId}>
                  <button
                    type="button"
                    className="onb-row"
                    onClick={() => setSelectedVendorId(vendor.publicId)}
                  >
                    <ProgressRing percent={percent} light small />

                    <span className="onb-row-main min-w-0">
                      <strong>{vendor.businessName}</strong>
                      <small>
                        {vendor.contact?.displayName ?? "—"} · {vendor.contact?.email ?? "no email"}
                      </small>
                      <span className="onb-row-flags">
                        <span
                          className={`onb-chip ${
                            isApproved
                              ? "is-approved"
                              : isPending
                                ? "is-pending"
                                : isRejected
                                  ? "is-rejected"
                                  : "is-missing"
                          }`}
                        >
                          {isApproved
                            ? "Approved"
                            : isPending
                              ? "Pending Review"
                              : isRejected
                                ? "Rejected"
                                : "Draft"}
                        </span>
                      </span>
                    </span>

                    <span className="onb-row-cell">
                      {vendor.businessType
                        ? vendor.businessType.replace(/_/g, " ")
                        : "Private Limited"}
                      <small>Business structure</small>
                    </span>

                    <span className="onb-row-cell">
                      {vendor.verifiedDocumentsCount} of {Math.max(vendor.documentsCount, 1)}{" "}
                      verified
                      <small>
                        {vendor.documentsCount > 0
                          ? `${vendor.documentsCount} uploaded`
                          : "0 uploaded"}
                      </small>
                    </span>

                    <span className="onb-row-cell">
                      {vendor.submittedAt
                        ? `Submitted ${new Date(vendor.submittedAt).toLocaleDateString()}`
                        : "Draft"}
                      <small>
                        {vendor.reviewedAt
                          ? `Reviewed ${new Date(vendor.reviewedAt).toLocaleDateString()}`
                          : isPending
                            ? "Awaiting review"
                            : "In progress"}
                      </small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flow-empty">
            <BadgeCheck aria-hidden />
            <p>No vendor applications found in this view.</p>
          </div>
        )}
      </section>

      {selectedVendorId && (
        <OpsVendorReviewDrawer
          vendorProfileId={selectedVendorId}
          onClose={() => setSelectedVendorId(null)}
          onUpdated={() => void query.refetch()}
        />
      )}
    </>
  );
}
