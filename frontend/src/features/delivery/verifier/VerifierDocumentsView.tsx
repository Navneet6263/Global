import { useState } from "react";
import { FileText, FolderOpen, Search } from "lucide-react";
import { DocumentFileActions } from "@/features/cases/document-file-actions";
import { formatBytes, formatDateTime, humanize } from "@/features/cases/case-detail-formatting";
import { Input } from "@/components/ui/input";
import type { VerifierTaskContext } from "@/lib/api/tasks";

export function VerifierDocumentsView({ context }: { context: VerifierTaskContext }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const documents = context.check.case.documents;
  const types = [...new Set(documents.map((document) => document.type))];
  const term = search.trim().toLowerCase();
  const visible = documents.filter(
    (document) =>
      (type === "all" || document.type === type) &&
      `${humanize(document.type)} ${document.versions[0]?.originalName ?? ""}`
        .toLowerCase()
        .includes(term),
  );
  return (
    <div className="min-w-0 space-y-4">
      <header className="rounded-2xl border border-mint/20 bg-mint-soft/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <FolderOpen className="size-5 text-mint-deep" />
            Case documents
          </h2>
          <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-medium">
            {documents.length} files
          </span>
        </div>
        <p className="mt-2 text-sm font-medium">
          {context.check.case.subject.fullName} · {humanize(context.check.type)} check
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          These files belong to this candidate&apos;s case. Your current access includes the case
          documents, not only this check. Use the document-type filter to focus on the evidence you
          need.
        </p>
      </header>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
        <div className="relative min-w-0">
          <Search
            aria-hidden
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search case documents"
            placeholder="Search document type or filename"
            className="w-full pl-9"
          />
        </div>
        <select
          aria-label="Document type"
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="h-10 min-w-0 rounded-full border border-border bg-white px-3 text-sm"
        >
          <option value="all">All document types</option>
          {types.map((item) => (
            <option key={item} value={item}>
              {humanize(item)}
            </option>
          ))}
        </select>
      </div>
      <p role="status" className="text-xs text-muted-foreground">
        Showing {visible.length} of {documents.length} files
      </p>
      <div className="space-y-3">
        {visible.map((document) => {
          const version = document.versions[0];
          return (
            <article
              key={document.publicId}
              className="min-w-0 rounded-2xl border border-border/70 bg-white p-4"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-info-soft text-info-foreground">
                  <FileText className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-[1_1_180px]">
                  <h3 className="text-sm font-semibold">{humanize(document.type)}</h3>
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {version?.originalName ?? "Awaiting upload"}
                  </p>
                  {version ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      v{version.version} · {formatBytes(version.sizeBytes)} · Scan:{" "}
                      {humanize(version.malwareState)}
                    </p>
                  ) : null}
                </div>
                {version ? (
                  <DocumentFileActions
                    documentId={document.publicId}
                    filename={version.originalName}
                    label={humanize(document.type)}
                    compact={false}
                  />
                ) : null}
              </div>
              {version ? (
                <details className="mt-3 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer font-medium">File details</summary>
                  <p className="mt-2">Uploaded {formatDateTime(version.createdAt)}</p>
                  <p className="mt-1 break-all font-mono text-[10px]">SHA-256 {version.sha256}</p>
                </details>
              ) : null}
            </article>
          );
        })}
      </div>
      {!visible.length ? (
        <div className="rounded-2xl border border-dashed border-border p-7 text-center text-sm text-muted-foreground">
          {documents.length
            ? "No files match. Try another document type or clear your search."
            : "No documents have been uploaded to this case yet."}
        </div>
      ) : null}
    </div>
  );
}
