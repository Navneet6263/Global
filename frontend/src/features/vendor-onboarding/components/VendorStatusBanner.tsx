import { AlertCircle, CheckCircle2, Clock, Info } from "lucide-react";
import type { VendorProfileData } from "../api/vendor-onboarding-api";

export function VendorStatusBanner({ profile }: { profile: VendorProfileData }) {
  switch (profile.verificationStatus) {
    case "PENDING_UPLOAD":
      return (
        <div
          className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-900"
          role="status"
        >
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden />
            <div>
              <h3 className="font-semibold text-blue-950">
                Action required: Upload business verification document
              </h3>
              <p className="mt-1 text-sm text-blue-800">
                To unlock your vendor workspace, please upload <strong>any one</strong> of the
                required business documents (Company PAN, GSTIN Certificate, or Legal Business
                Registration) below and click &quot;Submit for Verification&quot;.
              </p>
            </div>
          </div>
        </div>
      );

    case "PENDING_REVIEW":
      return (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900"
          role="status"
        >
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden />
            <div>
              <h3 className="font-semibold text-amber-950">Verification in progress</h3>
              <p className="mt-1 text-sm text-amber-800">
                Your business documents were submitted on{" "}
                {profile.submittedAt
                  ? new Date(profile.submittedAt).toLocaleDateString()
                  : "recently"}{" "}
                and are currently being reviewed by our Operations team. Your operational workspace
                will automatically unlock once approved.
              </p>
            </div>
          </div>
        </div>
      );

    case "REJECTED":
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900" role="alert">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
            <div>
              <h3 className="font-semibold text-red-950">
                Action required: Document revisions needed
              </h3>
              <p className="mt-1 text-sm text-red-800">
                Operations reviewed your submission and noted:{" "}
                <span className="font-medium italic text-red-950">
                  &quot;{profile.rejectionReason || "Please verify your business documents."}&quot;
                </span>
              </p>
              <p className="mt-1 text-sm text-red-800">
                Please upload an updated document revision below and re-submit your profile for
                review.
              </p>
            </div>
          </div>
        </div>
      );

    case "APPROVED":
      return (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900"
          role="status"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            <div>
              <h3 className="font-semibold text-emerald-950">Vendor profile verified & approved</h3>
              <p className="mt-1 text-sm text-emerald-800">
                Your business has been successfully verified! You now have full access to
                verification requests and checks.
              </p>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}
