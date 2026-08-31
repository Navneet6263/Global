import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileText, Loader2, ShieldCheck, UploadCloud } from "lucide-react";
import { useState } from "react";

import type { CandidateCase } from "@/lib/api/candidate-portal";
import { uploadCandidateDocument } from "@/lib/api/candidate-portal";
import { documentTypes, type DocumentType } from "@/lib/api/documents";
import { humanize } from "./candidate-utils";

const candidateDocumentTypes = documentTypes.filter((value) => value !== "OTHER");
const photoDocumentTypes = new Set<DocumentType>(["AADHAAR", "PAN", "PASSPORT", "DRIVING_LICENCE"]);

export function CandidateDocuments({
  accessId,
  token,
  caseStatus,
  documents,
}: {
  accessId: string;
  token: string;
  caseStatus: string;
  documents: CandidateCase["documents"];
}) {
  const canUpload = [
    "DRAFT",
    "CONSENT_PENDING",
    "DOCUMENT_PENDING",
    "IN_PROGRESS",
    "CLARIFICATION_PENDING",
  ].includes(caseStatus);
  const queryClient = useQueryClient();
  const [type, setType] = useState<DocumentType>("ADDRESS_PROOF");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Select a file first");
      return uploadCandidateDocument(accessId, token, type, file);
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
                  {humanize(value)}
                </option>
              ))}
            </select>
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
            disabled={!file || Boolean(fileError) || upload.isPending}
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
