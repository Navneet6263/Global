import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Circle, CircleCheck, LogOut, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";
import { clearIdentity } from "@/lib/auth/platform-session";
import { logout } from "@/lib/api/auth";
import {
  getVendorOnboardingMine,
  submitVendorOnboarding,
  uploadVendorDocument,
} from "@/features/vendor-onboarding/api/vendor-onboarding-api";
import { VendorDocumentCard } from "@/features/vendor-onboarding/components/VendorDocumentCard";
import { VendorOnboardingHero } from "@/features/vendor-onboarding/components/VendorOnboardingHero";

export const Route = createFileRoute("/vendor_/onboarding")({
  head: () => ({ meta: [{ title: "Vendor Onboarding & Verification — Sapling Global" }] }),
  beforeLoad: () => requireRoleWorkspace(["VENDOR"]),
  component: VendorOnboardingPage,
});

function CheckItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={ok ? "is-ok" : "is-wait"}>
      {ok ? <CircleCheck aria-hidden /> : <Circle aria-hidden />}
      <span>{label}</span>
    </li>
  );
}

function VendorOnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const query = useQuery({
    queryKey: ["vendor-onboarding-me"],
    queryFn: getVendorOnboardingMine,
    staleTime: 30_000,
    refetchInterval: (q) =>
      q.state.data?.profile?.verificationStatus === "PENDING_REVIEW" ? 15_000 : false,
  });

  const data = query.data;
  const profile = data?.profile;
  const isMainVendor = data?.isMainVendor ?? false;
  const canSubmit = data?.canSubmit ?? false;
  const documents = data?.documents ?? [];

  useEffect(() => {
    if (profile?.verificationStatus === "APPROVED") {
      clearIdentity();
    }
  }, [profile?.verificationStatus]);

  const handleUpload = async (
    docType: "COMPANY_PAN" | "GST_CERTIFICATE" | "BUSINESS_REGISTRATION",
    file: File,
  ) => {
    await uploadVendorDocument(docType, file);
    await queryClient.invalidateQueries({ queryKey: ["vendor-onboarding-me"] });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await submitVendorOnboarding();
      toast.success("Onboarding profile submitted for Operations review");
      await queryClient.invalidateQueries({ queryKey: ["vendor-onboarding-me"] });
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit onboarding");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      clearIdentity();
      void navigate({ to: "/auth" as any, replace: true });
    } catch {
      void navigate({ to: "/auth" as any, replace: true });
    }
  };

  if (query.isPending) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <ListSkeleton rows={6} />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <ErrorState
          title="Vendor onboarding could not load"
          description={query.error.message}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }

  if (!profile) return null;

  const uploadedCount = documents.filter((d) => d.latestRevision).length;
  const docsMap = new Map(documents.map((d) => [d.documentType, d]));
  const status = profile.verificationStatus;
  const canUpload = ["PENDING_UPLOAD", "REJECTED"].includes(status);

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" aria-hidden />
            <span className="font-bold tracking-tight text-slate-900">
              Sapling Global Vendor Verification
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{profile.businessName}</span>
            <Button size="sm" variant="ghost" onClick={handleLogout} title="Sign out">
              <LogOut className="mr-1 size-3.5" aria-hidden />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
        <VendorOnboardingHero profile={profile} uploadedCount={uploadedCount} />

        <div className="onb-layout mt-6">
          <div className="grid gap-4">
            <section className="client-panel" aria-labelledby="vendor-docs-title">
              <header className="client-panel-head">
                <div>
                  <h2 id="vendor-docs-title">Business verification documents</h2>
                  <p className="ops-subtle">
                    Upload at least one document to complete your profile verification.
                  </p>
                </div>
                <span className="flow-pill is-info">
                  {uploadedCount >= 1 ? "1 of 1 uploaded" : "0 of 1 uploaded"}
                </span>
              </header>

              <ul className="onb-docs">
                <VendorDocumentCard
                  docType="COMPANY_PAN"
                  document={docsMap.get("COMPANY_PAN")}
                  isMainVendor={isMainVendor}
                  canUpload={canUpload}
                  onUpload={(file) => handleUpload("COMPANY_PAN", file)}
                />
                <VendorDocumentCard
                  docType="GST_CERTIFICATE"
                  document={docsMap.get("GST_CERTIFICATE")}
                  isMainVendor={isMainVendor}
                  canUpload={canUpload}
                  onUpload={(file) => handleUpload("GST_CERTIFICATE", file)}
                />
                <VendorDocumentCard
                  docType="BUSINESS_REGISTRATION"
                  document={docsMap.get("BUSINESS_REGISTRATION")}
                  isMainVendor={isMainVendor}
                  canUpload={canUpload}
                  onUpload={(file) => handleUpload("BUSINESS_REGISTRATION", file)}
                />
              </ul>
            </section>
          </div>

          <aside className="onb-side">
            <section className="client-panel" aria-labelledby="vendor-checklist-title">
              <h2 id="vendor-checklist-title" className="mb-3 text-sm font-semibold">
                Verification checklist
              </h2>
              <ul className="onb-checks">
                <CheckItem ok label="Vendor account registered" />
                <CheckItem ok={uploadedCount >= 1} label="Business document uploaded" />
                <CheckItem ok={Boolean(profile.submittedAt)} label="Submitted for review" />
                <CheckItem ok={status === "APPROVED"} label="Approved by Operations" />
              </ul>
            </section>

            {isMainVendor && canUpload ? (
              <section className="client-panel" aria-labelledby="vendor-submit-title">
                <h2 id="vendor-submit-title" className="mb-2 text-sm font-semibold">
                  Submit application
                </h2>
                <p className="mb-4 text-xs text-muted-foreground">
                  Once submitted, our Operations team will inspect your documents and unlock your vendor workspace.
                </p>
                <Button
                  className="w-full"
                  disabled={!canSubmit || submitting}
                  loading={submitting}
                  onClick={handleSubmit}
                >
                  <Send className="mr-1.5 size-3.5" aria-hidden />
                  Submit for verification
                </Button>
              </section>
            ) : null}
          </aside>
        </div>
      </main>
    </div>
  );
}
