import { AlertCircle, Clock, Info, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/features/onboarding/onboarding-ui";
import type { VendorProfileData } from "../api/vendor-onboarding-api";

const JOURNEY = ["Account", "Business documents", "Operations review", "Live"];

export function VendorOnboardingHero({
  profile,
  uploadedCount,
}: {
  profile: VendorProfileData;
  uploadedCount: number;
}) {
  const status = profile.verificationStatus;
  const stepIndex = status === "APPROVED" ? 3 : status === "PENDING_REVIEW" ? 2 : 1;
  const progressPercent =
    status === "APPROVED" ? 100 : status === "PENDING_REVIEW" ? 75 : uploadedCount > 0 ? 50 : 25;

  return (
    <>
      <section className="onb-hero" aria-label="Onboarding progress">
        <div>
          <span
            className={`onb-status ${
              status === "APPROVED"
                ? "is-live"
                : status === "PENDING_REVIEW"
                  ? "is-review"
                  : status === "REJECTED"
                    ? "is-closed"
                    : ""
            }`}
          >
            <i aria-hidden />
            {status === "APPROVED"
              ? "Live & Verified"
              : status === "PENDING_REVIEW"
                ? "In Operations Review"
                : status === "REJECTED"
                  ? "Re-upload Needed"
                  : "Action Required: Upload Document"}
          </span>
          <h1 className="mt-3">
            {status === "APPROVED"
              ? `${profile.businessName} is approved`
              : `Welcome, ${profile.businessName}`}
          </h1>
          <p>
            {status === "APPROVED"
              ? "Your vendor business is verified. You now have full access to verification assignments and cases."
              : status === "PENDING_REVIEW"
                ? "Documents submitted. Operations is reviewing your business verification. You will be notified once approved."
                : status === "REJECTED"
                  ? "Operations requested corrections on your documents. Review the notes below, upload a new revision, and re-submit."
                  : "Upload any ONE of the legal business documents below (PAN, GSTIN, or Business Registration) to submit your account."}
          </p>
          <ol className="onb-journey" aria-label="Onboarding steps">
            {JOURNEY.map((label, index) => (
              <li
                key={label}
                className={index < stepIndex ? "is-done" : index === stepIndex ? "is-current" : ""}
                aria-current={index === stepIndex ? "step" : undefined}
              >
                <span>{label}</span>
              </li>
            ))}
          </ol>
        </div>
        <ProgressRing
          percent={progressPercent}
          label={status === "APPROVED" ? "approved" : "ready"}
        />
      </section>

      {status === "APPROVED" ? (
        <div className="onb-note is-good mt-4" role="status">
          <PartyPopper aria-hidden />
          <div>
            <strong>Your vendor workspace is active.</strong>
            <span>
              Verification cases and field requests can now be handled directly from your dashboard.
            </span>
            <div className="mt-2">
              <Button size="sm" onClick={() => window.location.assign("/vendor")}>
                Open Vendor Dashboard
              </Button>
            </div>
          </div>
        </div>
      ) : status === "REJECTED" ? (
        <div className="onb-note is-bad mt-4" role="alert">
          <AlertCircle aria-hidden />
          <div>
            <strong>Document revision requested</strong>
            <span>
              {profile.rejectionReason
                ? `Operations note: "${profile.rejectionReason}". `
                : "One or more documents were rejected. "}
              Please upload an updated replacement file below and submit for re-review.
            </span>
          </div>
        </div>
      ) : status === "PENDING_REVIEW" ? (
        <div className="onb-note mt-4" role="status">
          <Clock aria-hidden />
          <div>
            <strong>Verification under review</strong>
            <span>
              Submitted on{" "}
              {profile.submittedAt
                ? new Date(profile.submittedAt).toLocaleDateString()
                : "recently"}
              . Operations is verifying your compliance records.
            </span>
          </div>
        </div>
      ) : (
        <div className="onb-note mt-4" role="status">
          <Info aria-hidden />
          <div>
            <strong>Single document requirement</strong>
            <span>
              Upload any ONE legal document (Company PAN, GST Certificate, or Business
              Registration). All three are not mandatory.
            </span>
          </div>
        </div>
      )}
    </>
  );
}
