import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ShieldCheck, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { initialsOf, shortDate } from "@/features/onboarding/onboarding-format";
import {
  approveOpsVendor,
  getOpsVendorDetail,
  rejectOpsVendor,
  reviewOpsVendorDocument,
} from "../api/vendor-onboarding-api";
import { OpsVendorDocRow } from "./OpsVendorDocRow";

export function OpsVendorReviewDrawer({
  vendorProfileId,
  onClose,
  onUpdated,
}: {
  vendorProfileId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [acting, setActing] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const query = useQuery({
    queryKey: ["ops-vendor-detail", vendorProfileId],
    queryFn: () => getOpsVendorDetail(vendorProfileId),
  });

  const profile = query.data;

  const handleDocReview = async (docId: string, decision: "ACCEPT" | "REJECT", reason?: string) => {
    setActing(true);
    try {
      await reviewOpsVendorDocument(vendorProfileId, docId, {
        decision,
        rejectionReason: reason,
      });
      toast.success(decision === "ACCEPT" ? "Document accepted" : "Document marked rejected");
      await query.refetch();
      onUpdated();
    } catch (err) {
      toast.error(
        err instanceof Error && err.message ? err.message : "Failed to update document status",
      );
    } finally {
      setActing(false);
    }
  };

  const handleApprove = async () => {
    setActing(true);
    try {
      await approveOpsVendor(vendorProfileId);
      toast.success("Vendor approved successfully!");
      await query.refetch();
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to approve vendor");
    } finally {
      setActing(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) return;
    setActing(true);
    try {
      await rejectOpsVendor(vendorProfileId, rejectReason.trim());
      toast.success("Vendor application rejected");
      setRejectDialogOpen(false);
      await query.refetch();
      onUpdated();
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Failed to reject vendor");
    } finally {
      setActing(false);
    }
  };

  const documents = profile?.documents ?? [];
  const hasVerifiedDoc = documents.some((d) => d.status === "VERIFIED");
  const isApproved = profile?.verificationStatus === "APPROVED";
  // Any ONE verified document is enough; a rejected one beside it does not block it.
  const canApprove = hasVerifiedDoc && !isApproved;

  return (
    <Sheet open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[min(1080px,100vw)] lg:overflow-hidden"
      >
        {query.isPending ? (
          <div className="p-6">
            <ListSkeleton rows={6} />
          </div>
        ) : query.isError ? (
          <div className="p-6">
            <ErrorState
              title="Vendor verification could not load"
              description={query.error.message}
              onRetry={() => void query.refetch()}
            />
          </div>
        ) : profile ? (
          <div className="grid lg:h-full lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="grid content-start gap-4 border-slate-200 bg-slate-50 p-6 lg:overflow-y-auto lg:border-r">
              <SheetHeader className="p-0 text-left">
                <div className="flex items-start gap-3">
                  <span className="onb-rm-avatar" aria-hidden>
                    {initialsOf(profile.businessName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-lg">{profile.businessName}</SheetTitle>
                    <SheetDescription>
                      {profile.businessType?.replace(/_/g, " ")} · Registered{" "}
                      {shortDate(profile.createdAt)}
                    </SheetDescription>
                    <div className="onb-row-flags mt-1">
                      <span
                        className={`onb-chip ${
                          isApproved
                            ? "is-approved"
                            : profile.verificationStatus === "PENDING_REVIEW"
                              ? "is-pending"
                              : profile.verificationStatus === "REJECTED"
                                ? "is-rejected"
                                : "is-missing"
                        }`}
                      >
                        {profile.verificationStatus}
                      </span>
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <section className="onb-sheet-section" aria-label="Business contact">
                <h3>Contact & Signatory</h3>
                <dl className="onb-facts">
                  <dt>Contact Person</dt>
                  <dd>{profile.vendorUser?.displayName ?? "—"}</dd>
                  <dt>Email</dt>
                  <dd>{profile.vendorUser?.email ?? "—"}</dd>
                  <dt>Phone</dt>
                  <dd>{profile.vendorUser?.phone || "—"}</dd>
                  <dt>Signatory</dt>
                  <dd className="flex items-center gap-1 font-medium text-emerald-700">
                    <CheckCircle2 className="size-3.5" aria-hidden /> Authorised signatory
                  </dd>
                </dl>
              </section>

              <section className="onb-sheet-section" aria-label="Legal terms">
                <h3>Legal Evidence</h3>
                <dl className="onb-facts">
                  <dt>Terms Version</dt>
                  <dd>{profile.termsVersion ?? "v1.0"}</dd>
                  <dt>Privacy Version</dt>
                  <dd>{profile.privacyVersion ?? "v1.0"}</dd>
                  <dt>Accepted On</dt>
                  <dd>{profile.termsAcceptedAt ? shortDate(profile.termsAcceptedAt) : "—"}</dd>
                  <dt>Submitted Date</dt>
                  <dd>
                    {profile.submittedAt ? shortDate(profile.submittedAt) : "Not yet submitted"}
                  </dd>
                </dl>
              </section>
            </div>

            <div className="flex flex-col justify-between p-6 lg:overflow-y-auto">
              <div>
                <header className="border-b border-slate-200 pb-4">
                  <h2 className="text-base font-bold text-slate-900">Compliance Documents</h2>
                  <p className="ops-subtle text-xs">
                    Accept at least one legal business registration document (PAN, GSTIN, or
                    Business Registration) to approve.
                  </p>
                </header>

                <div className="mt-4">
                  {documents.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No documents uploaded.</p>
                  ) : (
                    <ul className="onb-docs">
                      {documents.map((doc) => (
                        <OpsVendorDocRow
                          key={doc.publicId}
                          doc={doc}
                          vendorProfileId={profile.publicId}
                          disabled={acting || isApproved}
                          onReview={handleDocReview}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <footer className="mt-8 border-t border-slate-200 pt-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  disabled={acting || profile.verificationStatus === "REJECTED"}
                  onClick={() => setRejectDialogOpen(true)}
                >
                  Reject Application
                </Button>

                <div className="flex items-center gap-3">
                  {!hasVerifiedDoc && !isApproved && (
                    <span className="text-xs text-amber-600">
                      * Must accept ≥1 document to approve
                    </span>
                  )}
                  <Button disabled={!canApprove || acting} loading={acting} onClick={handleApprove}>
                    {isApproved ? "Approved" : "Approve Vendor"}
                  </Button>
                </div>
              </footer>
            </div>
          </div>
        ) : null}
      </SheetContent>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <form onSubmit={handleReject}>
            <DialogHeader>
              <DialogTitle>Reject Vendor Application</DialogTitle>
              <DialogDescription>
                Provide detailed notes explaining what is missing or incorrect. The vendor will see
                these instructions upon sign-in.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <textarea
                required
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. GSTIN certificate is illegible; please upload an uncropped official PDF."
                className="w-full rounded border border-slate-300 p-2 text-xs"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRejectDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={!rejectReason.trim() || acting}
                loading={acting}
              >
                Confirm Rejection
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
