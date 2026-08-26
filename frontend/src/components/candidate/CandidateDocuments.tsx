import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { useState } from "react";

import { humanize } from "./candidate-utils";
import { uploadCandidateDocument, type CandidateCase } from "@/lib/api/candidate-portal";
import { documentTypes, type DocumentType } from "@/lib/api/documents";

export function CandidateDocuments({
  accessId,
  token,
  documents,
}: {
  accessId: string;
  token: string;
  documents: CandidateCase["documents"];
}) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<DocumentType>("ADDRESS_PROOF");
  const [file, setFile] = useState<File | null>(null);
  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Select a file first");
      return uploadCandidateDocument(accessId, token, type, file);
    },
    onSuccess: async () => {
      setFile(null);
      await queryClient.invalidateQueries({
        queryKey: ["candidate-portal", accessId, token],
      });
    },
  });
  return (
    <section className="surface rounded-3xl p-5">
      <h2 className="text-sm font-semibold">Upload supporting document</h2>
      <p className="text-xs leading-5 text-muted-foreground">
        Files are validated, integrity-hashed and attached only to this case.
      </p>
      <div className="mt-4 space-y-3">
        <select
          value={type}
          onChange={(event) => setType(event.target.value as DocumentType)}
          className="h-11 w-full rounded-2xl border border-border bg-background px-3 text-sm"
        >
          {documentTypes.map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </select>
        <label className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/30 text-center">
          <UploadCloud className="h-5 w-5 text-muted-foreground" />
          <span className="mt-2 max-w-full truncate px-4 text-xs text-muted-foreground">
            {file?.name ?? "Choose a PDF or image up to the allowed limit"}
          </span>
          <input
            key={file?.name ?? "empty"}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="sr-only"
          />
        </label>
        {upload.isError ? <p className="text-xs text-destructive">{upload.error.message}</p> : null}
        {upload.isSuccess ? (
          <p className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Document uploaded securely.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => upload.mutate()}
          disabled={!file || upload.isPending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {upload.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="h-4 w-4" />
          )}
          Upload document
        </button>
      </div>
      <div className="mt-5 border-t border-[var(--hairline)] pt-4">
        <p className="text-xs font-semibold">Uploaded documents</p>
        <div className="mt-2 space-y-2">
          {documents.length ? (
            documents.map((document, index) => (
              <div
                key={`${document.type}-${index}`}
                className="flex items-center justify-between rounded-xl bg-secondary/45 px-3 py-2"
              >
                <span className="text-xs">{humanize(document.type)}</span>
                <span className="text-[10px] text-muted-foreground">
                  v{document.currentVersion} · {humanize(document.status)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
