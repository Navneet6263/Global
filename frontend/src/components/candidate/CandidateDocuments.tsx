import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileText, Loader2, ShieldCheck, UploadCloud } from "lucide-react";
import { useState } from "react";

import type { CandidateCase } from "@/lib/api/candidate-portal";
import { uploadCandidateDocument } from "@/lib/api/candidate-portal";
import { documentTypes, type DocumentType } from "@/lib/api/documents";
import { humanize } from "./candidate-utils";

const photoDocumentTypes = new Set<DocumentType>(["AADHAAR", "PAN", "PASSPORT", "DRIVING_LICENCE"]);

export function CandidateDocuments({
  accessId,
  token,
  caseStatus,
  documents,
  requiredTypes,
  privacyNotice,
}: {
  accessId: string;
  token: string;
  caseStatus: string;
  documents: CandidateCase["documents"];
  requiredTypes: string[];
  privacyNotice: { version: string; title: string; paragraphs: string[] };
}) {
  const canUpload = [
    "DRAFT",
    "CONSENT_PENDING",
    "DOCUMENT_PENDING",
    "IN_PROGRESS",
    "CLARIFICATION_PENDING",
  ].includes(caseStatus);
  const candidateDocumentTypes = documentTypes.filter(
    (value) => value !== "OTHER" || requiredTypes.includes("OTHER"),
  );
  const queryClient = useQueryClient();
  const [type, setType] = useState<DocumentType>("ADDRESS_PROOF");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Select a file first");
      if (!acknowledged) throw new Error("Please read and acknowledge the privacy notice");
      return uploadCandidateDocument(
        accessId,
        token,
        type,
        file,
        privacyNotice.version,
        expiresAt || undefined,
      );
    },
    onSuccess: () => {
      setFile(null);
      void queryClient.invalidateQueries({ queryKey: ["candidate-portal", accessId, token] });
    },
  });

  return (
    <section className="surface rounded-[1.75rem] p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-primary">
          <UploadCloud className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold">Supporting documents</h2>
          <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
            Files are validated, integrity-hashed and attached only to this case.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-secondary/40 p-4">
        <h3 className="text-xs font-semibold">{privacyNotice.title}</h3>
        {privacyNotice.paragraphs.map((paragraph) => (
          <p key={paragraph} className="mt-2 text-[11px] leading-5 text-muted-foreground">
            {paragraph}
          </p>
        ))}
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 accent-primary"
          />
          I have read this notice ({privacyNotice.version}).
        </label>
      </div>
      {requiredTypes.length ? (
        <div className="mt-3 rounded-2xl border border-border p-3 text-xs">
          <p className="font-semibold">Required for your selected checks</p>
          {requiredTypes.map((required) => {
            const document = documents.find((doc) => doc.type === required);
            return (
              <p className="mt-2 flex justify-between gap-2" key={required}>
                <span>{humanize(required)}</span>
                <span
                  className={
                    document?.status === "VERIFIED" ? "text-success" : "text-warning-foreground"
                  }
                >
                  {document ? humanize(document.status) : "Upload needed"}
                </span>
              </p>
            );
          })}
        </div>
      ) : null}

      {canUpload ? (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-medium text-muted-foreground">
              Document type
            </span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as DocumentType)}
              className="h-11 w-full rounded-[1rem] border border-input bg-white/85 px-3 text-xs outline-none focus:ring-2 focus:ring-primary/15"
            >
              {candidateDocumentTypes.map((value) => (
                <option key={value} value={value}>
                  {value === "OTHER" ? "Other requested supporting document" : humanize(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] text-muted-foreground">
            Expiry date, if printed on this document
            <input
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-input bg-white px-3 text-xs"
            />
          </label>
          <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-[1.15rem] border border-dashed border-primary/30 bg-accent/40 px-4 text-center transition-colors hover:bg-accent/60">
            <span className="grid size-9 place-items-center rounded-full bg-white text-primary shadow-sm">
              <UploadCloud className="size-4" />
            </span>
            <span className="mt-2 max-w-full truncate text-xs font-medium">
              {file?.name ?? "Choose a PDF or image"}
            </span>
            <span className="mt-1 text-[9px] text-muted-foreground">
              PDF, JPEG or PNG · secure upload limits apply
            </span>
            <input
              key={file?.name ?? "empty"}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFileError(validateCandidateFile(selected));
                setFile(selected);
              }}
              className="sr-only"
            />
          </label>
          <div className="flex items-start gap-2 rounded-xl bg-secondary/50 px-3 py-2.5">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
            <p className="text-[10px] leading-4 text-muted-foreground">
              {photoDocumentTypes.has(type)
                ? "Upload a clear full document scan. PDFs must contain a readable document image/photo; text-only, blank, encrypted or damaged files are rejected."
                : "Upload the complete readable document. Blank, encrypted, damaged, active-script and mismatched files are rejected."}
            </p>
          </div>
          {fileError ? (
            <p className="rounded-xl bg-critical-soft px-3 py-2 text-xs text-critical-foreground">
              {fileError}
            </p>
          ) : null}
          {upload.isError ? (
            <p className="rounded-xl bg-critical-soft px-3 py-2 text-xs text-critical-foreground">
              {upload.error.message}
            </p>
          ) : null}
          {upload.isSuccess ? (
            <p className="flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-xs font-medium text-success-foreground">
              <CheckCircle2 className="size-4" /> Document uploaded securely.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => upload.mutate()}
            disabled={!file || !acknowledged || Boolean(fileError) || upload.isPending}
            aria-busy={upload.isPending}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-card)] disabled:opacity-45"
          >
            {upload.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <UploadCloud className="size-4" />
            )}
            {upload.isPending ? "Uploading securely" : "Upload document"}
          </button>
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-muted px-3 py-3 text-xs text-muted-foreground">
          Document uploads are locked because this verification is under final review or complete.
        </p>
      )}

      <div className="mt-5 border-t border-border/70 pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold">Uploaded documents</p>
          <span className="num rounded-full bg-secondary px-2.5 py-1 text-[10px] text-muted-foreground">
            {documents.length}
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {documents.length ? (
            documents.map((document, index) => (
              <div
                key={`${document.type}-${index}`}
                className="flex items-center gap-3 rounded-[1rem] bg-secondary/45 px-3 py-2.5"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-primary">
                  <FileText className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {humanize(document.type)}
                  {document.reviewNote ? (
                    <span className="mt-1 block whitespace-normal text-[10px] text-muted-foreground">
                      {document.reviewNote}
                    </span>
                  ) : null}
                </span>
                <span className="text-[9px] text-muted-foreground">
                  v{document.currentVersion} · {humanize(document.status)}
                </span>
              </div>
            ))
          ) : (
            <p className="rounded-[1rem] border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              No documents uploaded yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function validateCandidateFile(file: File | null) {
  if (!file) return "";
  if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type)) {
    return "Only PDF, JPEG and PNG documents are accepted.";
  }
  if (file.size === 0) return "The selected file is empty.";
  if (file.size > 10 * 1024 * 1024) return "The file exceeds the 10 MB upload limit.";
  const extension = file.name.split(".").pop()?.toLowerCase();
  const expected =
    file.type === "application/pdf"
      ? ["pdf"]
      : file.type === "image/png"
        ? ["png"]
        : ["jpg", "jpeg"];
  return expected.includes(extension ?? "")
    ? ""
    : "The file extension does not match its actual upload type.";
}
