import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/api/auth";
import type { CaseDetail } from "@/lib/api/cases";
import { invalidateWorkflow } from "@/lib/api/invalidate-workflow";
import { downloadReport, generateReport, listReports, retryReport } from "@/lib/api/reports";
import { previewReport, releaseReport, renewReportAccess } from "@/lib/backend-api/case-approvals";
import { Metric, Panel, Status } from "./case-detail-ui";
import { formatDateTime } from "./case-detail-formatting";

const reportLabels: Record<string, string> = {
  QUEUED: "Report preparation queued",
  FAILED: "Report preparation needs attention",
  PREPARED: "Prepared — payment pending",
  PUBLISHED: "Released report",
  SUPERSEDED: "Previous report — superseded",
};

export function ReportsPanel({ item }: { item: CaseDetail }) {
  const client = useQueryClient();
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const canRead = session.data?.permissions.some((permission) =>
    ["*", "report:read"].includes(permission),
  );
  const isManager = Boolean(
    session.data?.roles.some((role) => ["PLATFORM_ADMIN", "OPS_MANAGER"].includes(role)),
  );
  const reports = useQuery({
    queryKey: ["reports", item.id],
    queryFn: () => listReports(item.id),
    enabled: Boolean(canRead),
    refetchInterval: (query) =>
      query.state.data?.items.some((report) => report.status === "QUEUED") ? 5000 : false,
  });
  const action = useMutation({
    mutationFn: async ({
      kind,
      id,
    }: {
      kind: "download" | "preview" | "retry" | "release" | "renew" | "generate";
      id: string;
    }) => {
      if (kind === "download") return downloadReport(id, item.caseNumber);
      if (kind === "preview") return previewReport(id, item.caseNumber);
      if (kind === "retry") await retryReport(item.id, id);
      if (kind === "release") await releaseReport(item.id, id);
      if (kind === "renew") await renewReportAccess(id);
      if (kind === "generate") await generateReport(item.id);
      await invalidateWorkflow(client);
      await client.invalidateQueries({ queryKey: ["case-approval", item.id] });
      toast.success(
        kind === "release"
          ? "Report released after payment verification"
          : kind === "renew"
            ? "Download access renewed"
            : "Report request accepted",
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const latest = reports.data?.items[0];
  return (
    <Panel title="QA & reports" subtitle="Reviewed snapshots, billing status and report history">
      <div className="grid grid-cols-2 gap-3">
        <Metric label="QA reviews" value={String(item.qaReviews.length)} light />
        <Metric
          label="Report records"
          value={String(reports.data?.items.length ?? item.reports.length)}
          light
        />
      </div>
      {item.qaReviews[0] ? (
        <div className="mt-3">
          <Status status={item.qaReviews[0].decision} />
        </div>
      ) : null}
      {reports.isPending && canRead ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading report status…</p>
      ) : null}
      {reports.isError ? (
        <div className="mt-4 space-y-2 text-sm text-destructive">
          <p>{reports.error.message}</p>
          <Button variant="outline" onClick={() => void reports.refetch()}>
            Retry loading
          </Button>
        </div>
      ) : null}
      {latest ? (
        <div
          className={`mt-4 rounded-2xl border p-4 ${latest.status === "PREPARED" ? "border-orange-100 bg-orange-50/80" : "border-emerald-100 bg-emerald-50/50"}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">
                {reportLabels[latest.status] ?? latest.status}
                {latest.currentVersion > 0 ? ` · v${latest.currentVersion}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {latest.publishedAt
                  ? formatDateTime(latest.publishedAt)
                  : latest.status === "PREPARED"
                    ? "Finance can invoice this report. Client download unlocks after full payment."
                    : latest.status === "SUPERSEDED"
                      ? "Historical file preserved; a new review is in progress."
                      : "Refresh to check the latest processing result."}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void reports.refetch()}
              aria-label="Refresh reports"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {latest.status === "PUBLISHED" && latest.canDownload !== false ? (
              <Button
                onClick={() => action.mutate({ kind: "download", id: latest.id })}
                disabled={action.isPending}
                loading={
                  action.isPending &&
                  action.variables?.kind === "download" &&
                  action.variables.id === latest.id
                }
                className="gap-2 rounded-full"
              >
                <Download className="size-4" />
                Download report
              </Button>
            ) : null}
            {isManager &&
            ["PREPARED", "PUBLISHED", "SUPERSEDED"].includes(latest.status) &&
            latest.currentVersion > 0 ? (
              <Button
                variant="outline"
                onClick={() => action.mutate({ kind: "preview", id: latest.id })}
                disabled={action.isPending}
                loading={
                  action.isPending &&
                  action.variables?.kind === "preview" &&
                  action.variables.id === latest.id
                }
                className="gap-2 rounded-full"
              >
                <Eye className="size-4" />
                Internal preview
              </Button>
            ) : null}
            {isManager && latest.status === "FAILED" && latest.workflowVersion === 2 ? (
              <Button
                variant="outline"
                onClick={() => action.mutate({ kind: "retry", id: latest.id })}
                disabled={action.isPending}
                loading={
                  action.isPending &&
                  action.variables?.kind === "retry" &&
                  action.variables.id === latest.id
                }
              >
                Retry preparation
              </Button>
            ) : null}
            {isManager && latest.status === "PREPARED" ? (
              <Button
                variant="outline"
                onClick={() => action.mutate({ kind: "release", id: latest.id })}
                disabled={action.isPending}
                loading={
                  action.isPending &&
                  action.variables?.kind === "release" &&
                  action.variables.id === latest.id
                }
              >
                Recheck payment & release
              </Button>
            ) : null}
            {isManager && latest.status === "PUBLISHED" && latest.canDownload === false ? (
              <Button
                variant="outline"
                onClick={() => action.mutate({ kind: "renew", id: latest.id })}
                disabled={action.isPending}
                loading={
                  action.isPending &&
                  action.variables?.kind === "renew" &&
                  action.variables.id === latest.id
                }
              >
                Renew download access
              </Button>
            ) : null}
          </div>
          {latest.status === "PUBLISHED" && latest.canDownload === false ? (
            <p className="mt-3 text-xs text-amber-900">
              Download access expired. Ask Operations to renew it.
            </p>
          ) : null}
          {latest.status === "PUBLISHED" && latest.downloadExpiresAt ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Download available until {formatDateTime(latest.downloadExpiresAt)}
            </p>
          ) : null}
          {latest.versions[0] && latest.status === "PUBLISHED" ? (
            <a
              href={`/reports/verify/${encodeURIComponent(latest.versions[0].authenticityCode)}`}
              className="mt-3 inline-block text-xs font-medium text-emerald-900 underline underline-offset-4"
            >
              Verify report authenticity
            </a>
          ) : null}
        </div>
      ) : !reports.isPending && !reports.isError ? (
        <p className="mt-4 text-sm text-muted-foreground">
          The report is prepared after independent manager approval.
        </p>
      ) : null}
      {isManager && item.status === "REPORT_PENDING" && latest?.status === "QUEUED" ? (
        <Button
          className="mt-3"
          variant="outline"
          disabled={action.isPending}
          loading={
            action.isPending &&
            action.variables?.kind === "generate" &&
            action.variables.id === latest.id
          }
          onClick={() => action.mutate({ kind: "generate", id: latest.id })}
        >
          Prepare approved report now
        </Button>
      ) : null}
      {(reports.data?.items.length ?? 0) > 1 ? (
        <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
          <p className="text-xs font-semibold text-muted-foreground">Earlier report history</p>
          {reports.data!.items.slice(1).map((report) => (
            <div
              key={report.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-secondary/30 p-3 text-xs"
            >
              <span>
                v{report.currentVersion} · {reportLabels[report.status] ?? report.status}
              </span>
              {isManager && report.currentVersion > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={action.isPending}
                  loading={
                    action.isPending &&
                    action.variables?.kind === "preview" &&
                    action.variables.id === report.id
                  }
                  onClick={() => action.mutate({ kind: "preview", id: report.id })}
                >
                  View retained file
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </Panel>
  );
}
