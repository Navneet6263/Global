import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileDown, FileText, Plus, Send, ShieldCheck, UploadCloud } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Empty, EntityList, Metric, Panel, Status } from "@/features/cases/case-detail-ui";
import { formatBytes, formatDateTime, humanize } from "@/features/cases/case-detail-formatting";
import { getSession } from "@/lib/api/auth";
import type { CaseDetail } from "@/lib/api/cases";
import { requestConsent } from "@/lib/api/consents";
import {
  createDocument,
  documentTypes,
  downloadDocument,
  uploadDocument,
  type DocumentType,
} from "@/lib/api/documents";
import { downloadReport, generateReport, listReports, retryReport } from "@/lib/api/reports";

export function DocumentPanel({ item }: { item: CaseDetail }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<DocumentType>("AADHAAR");
  const [file, setFile] = useState<File | null>(null);
  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 60_000,
  });
  const canWrite =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("document:write");
  const canRead =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("document:read");
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Select a file to upload");
      const document = await createDocument(item.id, type);
      return uploadDocument(document.id, file);
    },
    onSuccess: async () => {
      toast.success("Document uploaded and integrity hash recorded");
      setFile(null);
      await queryClient.invalidateQueries({ queryKey: ["case", item.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const download = useMutation({
    mutationFn: (document: CaseDetail["documents"][number]) => {
      const filename = document.versions.at(-1)?.originalName ?? `${humanize(document.type)}.pdf`;
      return downloadDocument(document.publicId, filename);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <Panel title="Documents" subtitle="Versioned evidence with integrity and safety checks">
      {canWrite ? (
        <div className="mb-4 grid gap-2 rounded-2xl border border-dashed border-border bg-secondary/25 p-3 sm:grid-cols-[minmax(10rem,0.65fr)_minmax(12rem,1fr)_auto]">
          <select
            value={type}
            onChange={(event) => setType(event.target.value as DocumentType)}
            aria-label="Document type"
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
          >
            {documentTypes.map((documentType) => (
              <option key={documentType} value={documentType}>
                {humanize(documentType)}
              </option>
            ))}
          </select>
          <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm">
            <UploadCloud className="h-4 w-4 text-muted-foreground" />
            <span className="min-w-0 truncate">{file?.name ?? "Choose PDF or image"}</span>
            <input
              key={file?.name ?? "empty"}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>
          <button
            type="button"
            onClick={() => upload.mutate()}
            disabled={!file || upload.isPending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {upload.isPending ? "Securing…" : "Add document"}
          </button>
        </div>
      ) : null}

      {item.documents.length ? (
        <div className="divide-y divide-[var(--hairline)]">
          {item.documents.map((document) => {
            const latest = document.versions[0];
            return (
              <div
                key={document.publicId}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{humanize(document.type)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {latest
                      ? `v${latest.version} · ${formatBytes(latest.sizeBytes)} · ${humanize(latest.malwareState)}`
                      : "Awaiting first version"}
                  </p>
                </div>
                <Status status={document.status} />
                {canRead && document.status === "AVAILABLE" ? (
                  <button
                    type="button"
                    onClick={() => download.mutate(document)}
                    disabled={download.isPending}
                    aria-label={`Download ${humanize(document.type)}`}
                    className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background transition-colors hover:bg-secondary disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <Empty text="No documents requested or uploaded" />
      )}
    </Panel>
  );
}

export function ReportsPanel({ item }: { item: CaseDetail }) {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 60_000,
  });
  const canRead =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("report:read");
  const canGenerate =
    session.data?.permissions.includes("*") ||
    session.data?.permissions.includes("report:generate");
  const reports = useQuery({
    queryKey: ["reports", item.id],
    queryFn: () => listReports(item.id),
    enabled: Boolean(canRead),
  });
  const generate = useMutation({
    mutationFn: () => generateReport(item.id),
    onSuccess: async () => {
      toast.success("Signed report version published");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["reports", item.id] }),
        queryClient.invalidateQueries({ queryKey: ["case", item.id] }),
      ]);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const download = useMutation({
    mutationFn: (reportId: string) => downloadReport(reportId, item.caseNumber),
    onError: (error: Error) => toast.error(error.message),
  });
  const retry = useMutation({
    mutationFn: (reportId: string) => retryReport(item.id, reportId),
    onSuccess: async () => {
      toast.success("Report retry queued");
      await queryClient.invalidateQueries({ queryKey: ["reports", item.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const latest = reports.data?.items[0];
  const latestVersion = latest?.versions[0];

  return (
    <Panel title="QA & reports" subtitle="Independent review and versioned output">
      <div className="grid grid-cols-2 gap-3">
        <Metric label="QA reviews" value={String(item.qaReviews.length)} light />
        <Metric
          label="Reports"
          value={String(reports.data?.items.length ?? item.reports.length)}
          light
        />
      </div>
      {item.qaReviews[0] ? (
        <div className="mt-3">
          <Status status={item.qaReviews[0].decision} />
        </div>
      ) : null}

      {latest ? (
        <div className="mt-4 rounded-2xl border border-[var(--hairline)] bg-secondary/35 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                {latest.status === "PUBLISHED"
                  ? `Published report v${latest.currentVersion}`
                  : latest.status === "FAILED"
                    ? "Report generation failed"
                    : "Report generation queued"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {latest.publishedAt ? formatDateTime(latest.publishedAt) : "Publishing"}
              </p>
            </div>
            {latest.status === "PUBLISHED" ? (
              <button
                type="button"
                onClick={() => download.mutate(latest.id)}
                disabled={download.isPending}
                className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
                aria-label="Download published report"
              >
                <FileDown className="h-4 w-4" />
              </button>
            ) : latest.status === "FAILED" && canGenerate ? (
              <button
                type="button"
                onClick={() => retry.mutate(latest.id)}
                disabled={retry.isPending}
                className="rounded-full bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground disabled:opacity-50"
              >
                {retry.isPending ? "Retrying…" : "Retry report"}
              </button>
            ) : null}
          </div>
          {latestVersion ? (
            <a
              href={`/reports/verify/${encodeURIComponent(latestVersion.authenticityCode)}`}
              className="mt-3 block truncate text-xs font-semibold text-accent-foreground underline-offset-4 hover:underline"
            >
              Verify {latestVersion.authenticityCode}
            </a>
          ) : null}
        </div>
      ) : canGenerate && ["COMPLETED", "CLOSED"].includes(item.status) ? (
        <button
          type="button"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          <FileDown className="h-4 w-4" />
          {generate.isPending ? "Generating…" : "Generate signed report"}
        </button>
      ) : null}
    </Panel>
  );
}

export function ConsentPanel({ item }: { item: CaseDetail }) {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
    staleTime: 60_000,
  });
  const consent = item.consents[0];
  const canManage =
    session.data?.permissions.includes("*") || session.data?.permissions.includes("consent:manage");
  const mutation = useMutation({
    mutationFn: () => requestConsent(item.id),
    onSuccess: async (result) => {
      toast.success("Consent OTP queued", {
        description: `Request expires ${formatDateTime(result.expiresAt)}`,
      });
      await queryClient.invalidateQueries({ queryKey: ["case", item.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Panel title="Consent" subtitle="Latest consent state">
      {consent ? (
        <div className="rounded-2xl bg-secondary/45 p-4">
          <div className="flex items-center justify-between gap-3">
            <ShieldCheck className="h-5 w-5 text-accent-foreground" />
            <Status status={consent.status} />
          </div>
          <p className="mt-3 text-sm font-semibold">Notice {consent.noticeVersion}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{consent.purpose}</p>
          {canManage && consent.status !== "ACCEPTED" ? (
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {mutation.isPending ? "Queuing…" : "Send consent OTP"}
            </button>
          ) : null}
        </div>
      ) : (
        <Empty text="Consent has not been requested" />
      )}
    </Panel>
  );
}
