import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CircleCheck,
  CircleCheckBig,
  FileUp,
  FileWarning,
  LockKeyhole,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  completeCandidatePortal,
  uploadCandidateDocument,
  type CandidatePortalData,
} from "@/lib/api/candidate-portal";
import { CandidateConsentStep } from "./CandidateConsentStep";
import { ClarificationCard } from "./CandidateChecks";
import { formatDate } from "./candidate-utils";

const DOCS: Record<string, { label: string; hint: string; expiry?: boolean }> = {
  AADHAAR: { label: "Aadhaar card", hint: "Front and back in one PDF, or a clear photo." },
  PAN: { label: "PAN card", hint: "A clear photo or scan of your PAN card." },
  PASSPORT: { label: "Passport", hint: "First and last page.", expiry: true },
  DRIVING_LICENCE: { label: "Driving licence", hint: "Front and back.", expiry: true },
  ADDRESS_PROOF: {
    label: "Address proof",
    hint: "Utility bill, rent agreement or bank statement from the last 3 months.",
  },
  EDUCATION_CERTIFICATE: {
    label: "Education certificate",
    hint: "Your highest degree certificate or final marksheet.",
  },
  EMPLOYMENT_PROOF: {
    label: "Employment proof",
    hint: "Relieving letter, experience letter or recent payslips.",
  },
  OTHER: { label: "Other requested document", hint: "The document the team asked you for." },
};
const docMeta = (type: string) =>
  DOCS[type] ?? { label: type.replaceAll("_", " ").toLowerCase(), hint: "" };

function validateFile(file: File) {
  if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type))
    return "Only PDF, JPG or PNG files are accepted.";
  if (file.size === 0) return "The selected file is empty.";
  if (file.size > 10 * 1024 * 1024) return "The file is larger than 10 MB.";
  return "";
}

/** The candidate's one job: upload what was asked, then confirm they are done. */
export function CandidateUploadPage({
  accessId,
  token,
  portal,
}: {
  accessId: string;
  token: string;
  portal: CandidatePortalData;
}) {
  const data = portal.case;
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const items = data.uploadItems;
  const done = items.filter(
    (item) => item.state === "UPLOADED" || item.state === "VERIFIED",
  ).length;
  const percent = items.length ? Math.round((done / items.length) * 100) : 100;
  const firstName = data.candidateName.split(" ")[0] ?? data.candidateName;
  const openQuestions = data.clarifications.filter((item) => item.status === "OPEN");
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["candidate-portal", accessId, token] });
  // Open the uploads at once; the full page data refreshes in the background.
  const consentRecorded = () => {
    queryClient.setQueryData<CandidatePortalData>(["candidate-portal", accessId, token], (old) =>
      old ? { ...old, case: { ...old.case, consentStatus: "ACCEPTED" } } : old,
    );
    void refresh();
  };

  const complete = useMutation({
    mutationFn: () => completeCandidatePortal(accessId, token),
    onSuccess: async () => {
      setConfirming(false);
      await refresh();
    },
    onError: (error: Error) => toast.error("Not completed", { description: error.message }),
  });

  if (portal.completedAt)
    return (
      <section className="cand-done" aria-labelledby="cand-done-title">
        <span className="cand-done-icon" aria-hidden>
          <CircleCheckBig />
        </span>
        <h1 id="cand-done-title">You're all set, {firstName}</h1>
        <p>
          We received your documents on {formatDate(portal.completedAt)}. This link is now closed —
          there is nothing more you need to do.
        </p>
        <ul>
          {items.map((item) => (
            <li key={item.type}>
              <Check aria-hidden /> {docMeta(item.type).label}
            </li>
          ))}
        </ul>
        <p className="text-[13px]">
          If {data.clientName} or our team needs anything else, you will get a new link by email.
          Your consent is already recorded.
        </p>
      </section>
    );

  // Consent happens once, inside this same link; uploads open after it.
  const consentDone = data.consentStatus === "ACCEPTED" || data.consentStatus === "NOT_REQUESTED";
  return (
    <div className="cand">
      <section className="cand-hero" aria-labelledby="cand-title">
        <div>
          <h1 id="cand-title">Hi {firstName},</h1>
          <p>
            {data.clientName} has asked Sapling Global to verify your background.{" "}
            {consentDone
              ? "Upload the documents below — it usually takes about 5 minutes."
              : "Confirm your consent with a code we email you, then upload the documents."}
          </p>
          <ol className="cand-steps" aria-label="Your steps">
            <li className={consentDone ? "is-done" : "is-now"}>
              <span>{consentDone ? <Check aria-hidden /> : 1}</span>
              {consentDone ? "Consent recorded" : "Give consent"}
            </li>
            <li className={data.readyToComplete ? "is-done" : consentDone ? "is-now" : ""}>
              <span>{data.readyToComplete ? <Check aria-hidden /> : 2}</span>
              Upload documents
            </li>
            <li className={data.readyToComplete ? "is-now" : ""}>
              <span>3</span>
              Confirm you're done
            </li>
          </ol>
        </div>
        <div
          className="cand-ring"
          role="img"
          aria-label={`${done} of ${items.length} documents uploaded`}
        >
          <svg viewBox="0 0 100 100" aria-hidden>
            <circle className="track" cx="50" cy="50" r="42" />
            <circle
              className="bar"
              cx="50"
              cy="50"
              r="42"
              strokeDasharray={2 * Math.PI * 42}
              strokeDashoffset={2 * Math.PI * 42 * (1 - percent / 100)}
            />
          </svg>
          <span>
            {done}/{items.length}
            <small>uploaded</small>
          </span>
        </div>
      </section>

      {openQuestions.length ? (
        <section className="cand-card p-4" aria-label="Questions from the team">
          <h2 className="mb-3 text-[15px] font-semibold">Questions from the team</h2>
          <div className="space-y-3">
            {openQuestions.map((item) => (
              <ClarificationCard key={item.id} accessId={accessId} token={token} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {consentDone ? (
        <>
          <section className="cand-card" aria-labelledby="cand-docs-title">
            <header className="cand-card-head">
              <h2 id="cand-docs-title">Documents we need</h2>
              <p>PDF, JPG or PNG up to 10 MB. Only these documents are needed.</p>
            </header>
            {items.length ? (
              <ul className="cand-docs" aria-label="Documents to upload">
                {items.map((item) => (
                  <DocumentRow
                    key={item.type}
                    accessId={accessId}
                    token={token}
                    item={item}
                    noticeVersion={portal.privacyNotice.version}
                    acknowledged={consentDone}
                    onUploaded={refresh}
                  />
                ))}
              </ul>
            ) : (
              <p className="px-5 pb-5 text-[13px] text-slate-500">
                No documents are needed from you right now.
              </p>
            )}
            <p className="flex items-center gap-2 border-t border-slate-100 px-5 py-3 text-[12px] text-slate-500">
              <LockKeyhole className="size-3.5" aria-hidden /> Files are encrypted and shared only
              with the verification team for this case.
            </p>
          </section>

          <div className="cand-bar">
            <div className="cand-bar-inner">
              <p>
                <strong>
                  {done} of {items.length}
                </strong>{" "}
                documents uploaded
              </p>
              <button
                type="button"
                className="cand-complete"
                disabled={!data.readyToComplete || complete.isPending}
                onClick={() => setConfirming(true)}
              >
                <CircleCheck aria-hidden /> Complete — I've uploaded all documents
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <CandidateConsentStep
            accessId={accessId}
            token={token}
            portal={portal}
            onConfirmed={consentRecorded}
          />
          <section className="cand-card" aria-labelledby="cand-docs-title">
            <header className="cand-card-head">
              <h2 id="cand-docs-title">Documents we need</h2>
              <p>Upload opens right after you confirm your consent.</p>
            </header>
            <p className="cand-docs-locked">
              <LockKeyhole aria-hidden />
              <span>
                {items.map((item) => docMeta(item.type).label).join(" · ") || "None right now"}
              </span>
            </p>
          </section>
        </>
      )}

      {confirming ? (
        <Dialog
          open
          onOpenChange={(open) => (!open && !complete.isPending ? setConfirming(false) : undefined)}
        >
          <DialogContent className="sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle>Submit your documents?</DialogTitle>
              <DialogDescription>
                This link closes after you confirm. If anything else is needed, we will email you a
                new link — you won't need to give consent again.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setConfirming(false)}
                disabled={complete.isPending}
              >
                Not yet
              </Button>
              <Button onClick={() => complete.mutate()} loading={complete.isPending}>
                <ShieldCheck className="size-4" aria-hidden /> Yes, I'm done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

function DocumentRow({
  accessId,
  token,
  item,
  noticeVersion,
  acknowledged,
  onUploaded,
}: {
  accessId: string;
  token: string;
  item: CandidatePortalData["case"]["uploadItems"][number];
  noticeVersion: string;
  acknowledged: boolean;
  onUploaded: () => Promise<unknown>;
}) {
  const meta = docMeta(item.type);
  const input = useRef<HTMLInputElement>(null);
  const [expiry, setExpiry] = useState("");
  const [error, setError] = useState("");
  const upload = useMutation({
    mutationFn: (file: File) =>
      uploadCandidateDocument(accessId, token, item.type, file, noticeVersion, expiry || undefined),
    onSuccess: async () => {
      setError("");
      toast.success(`${meta.label} uploaded`);
      await onUploaded();
    },
    onError: (failure: Error) => setError(failure.message),
  });
  const uploaded = item.state === "UPLOADED" || item.state === "VERIFIED";
  const again = item.state === "REUPLOAD";
  return (
    <li className={`cand-doc ${uploaded ? "is-done" : again ? "is-again" : ""}`}>
      <span className="cand-doc-icon" aria-hidden>
        {uploaded ? <CircleCheck /> : again ? <FileWarning /> : <FileUp />}
      </span>
      <div className="min-w-0">
        <strong>
          {meta.label}
          <span className={`cand-chip ${uploaded ? "is-done" : again ? "is-again" : "is-needed"}`}>
            {item.state === "VERIFIED"
              ? "Accepted"
              : uploaded
                ? "Uploaded"
                : again
                  ? "Upload again"
                  : "Needed"}
          </span>
        </strong>
        <small>{meta.hint}</small>
        {again && item.reviewNote ? <p className="cand-doc-reason">{item.reviewNote}</p> : null}
        {error ? <p className="cand-doc-reason">{error}</p> : null}
      </div>
      {item.state === "VERIFIED" ? null : (
        <div className="cand-doc-actions">
          {meta.expiry && !uploaded ? (
            <label className="text-[12px] text-slate-500">
              Expiry{" "}
              <input
                type="date"
                value={expiry}
                onChange={(event) => setExpiry(event.target.value)}
                aria-label={`${meta.label} expiry date`}
              />
            </label>
          ) : null}
          <input
            ref={input}
            type="file"
            hidden
            accept="application/pdf,image/jpeg,image/png"
            aria-label={`Upload ${meta.label}`}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const problem = validateFile(file);
              if (problem) setError(problem);
              else upload.mutate(file);
            }}
          />
          <button
            type="button"
            className={`cand-upload ${uploaded ? "is-secondary" : ""}`}
            disabled={!acknowledged || upload.isPending}
            title={acknowledged ? undefined : "Tick the privacy notice first"}
            onClick={() => input.current?.click()}
          >
            <Upload aria-hidden />
            {upload.isPending ? "Uploading…" : uploaded ? "Replace" : "Upload"}
          </button>
        </div>
      )}
    </li>
  );
}
