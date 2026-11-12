import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CircleCheck, FileUp, FileWarning, Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadCandidateDocument, type CandidatePortalData } from "@/lib/api/candidate-portal";
import { docMeta, validateCandidateFile } from "./candidate-utils";

export function CandidateDocumentRow({
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
        {item.forChecks?.length ? (
          <small className="block">
            For your{" "}
            {item.forChecks.map((check) => check.replaceAll("_", " ").toLowerCase()).join(", ")}{" "}
            check
          </small>
        ) : null}
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
              const problem = validateCandidateFile(file);
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
