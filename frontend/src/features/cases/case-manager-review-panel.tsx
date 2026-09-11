import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Clock3, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getSession } from "@/lib/api/auth";
import type { CaseDetail } from "@/lib/api/cases";
import { invalidateWorkflow } from "@/lib/api/invalidate-workflow";
import { getCaseApproval, submitManagerReview } from "@/lib/backend-api/case-approvals";
import { formatDateTime } from "./case-detail-formatting";
import { CaseReopenForm } from "./case-reopen-form";

const finalStages = ["MANAGER_REVIEW", "REPORT_PENDING", "PAYMENT_PENDING", "COMPLETED", "CLOSED"];

export function CaseManagerReviewPanel({ item }: { item: CaseDetail }) {
  const client = useQueryClient();
  const [notes, setNotes] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const isManager = Boolean(
    session.data?.roles.some((role) => ["PLATFORM_ADMIN", "OPS_MANAGER"].includes(role)),
  );
  const approval = useQuery({
    queryKey: ["case-approval", item.id, item.version],
    queryFn: () => getCaseApproval(item.id),
    enabled: isManager,
    staleTime: 15_000,
  });
  const highRisk = item.checks.some((check) =>
    ["HIGH", "CRITICAL"].includes(check.riskLevel ?? ""),
  );
  const mutation = useMutation({
    mutationFn: (decision: "APPROVED" | "REWORK") =>
      submitManagerReview(item.id, {
        caseVersion: approval.data?.caseVersion ?? item.version,
        decision,
        notes: notes.trim(),
        recommendation: decision === "APPROVED" ? recommendation.trim() : undefined,
        highRiskAcknowledged: acknowledged,
      }),
    onSuccess: (result) => {
      toast.success(
        result.caseStatus === "REPORT_PENDING"
          ? "Manager approved. Report preparation queued."
          : "Case returned to independent QA review.",
      );
      setNotes("");
      setRecommendation("");
      setAcknowledged(false);
      void invalidateWorkflow(client);
      void client.invalidateQueries({ queryKey: ["case-approval", item.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (!finalStages.includes(item.status)) return null;
  const waiting = item.status === "MANAGER_REVIEW" || approval.data?.legacyApprovalRequired;
  return (
    <section className="surface rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50/70 via-white to-white p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-800">
          <ShieldCheck className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">Approval & release</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Independent manager review, billing and controlled client delivery.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <Stage
          label="Manager decision"
          done={
            !waiting &&
            ["REPORT_PENDING", "PAYMENT_PENDING", "COMPLETED", "CLOSED"].includes(item.status)
          }
        />
        <Stage
          label="Report preparation"
          done={["PAYMENT_PENDING", "COMPLETED", "CLOSED"].includes(item.status)}
        />
        <Stage
          label="Paid & released"
          done={item.reports.some((report) => report.status === "PUBLISHED")}
        />
      </div>
      {item.status === "PAYMENT_PENDING" ? (
        <p className="mt-4 rounded-2xl bg-orange-50 p-4 text-sm text-orange-950">
          Report prepared. Finance must invoice this report and record full payment before the
          client can download it.
        </p>
      ) : null}
      {item.status === "REPORT_PENDING" ? (
        <p className="mt-4 text-sm text-muted-foreground">
          The approved snapshot is being prepared as a report. Its status is shown below.
        </p>
      ) : null}
      {isManager && approval.isPending ? (
        <p className="mt-4 text-sm text-muted-foreground">Loading approval history…</p>
      ) : null}
      {approval.isError ? (
        <div className="mt-4 text-sm text-destructive">
          <p>{approval.error.message}</p>
          <Button variant="outline" onClick={() => void approval.refetch()}>
            Retry
          </Button>
        </div>
      ) : null}
      {approval.data?.legacyApprovalRequired ? (
        <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
          This older case has an unfinished report. An independent manager must review it before the
          new billing and release flow can proceed.
        </p>
      ) : null}
      {waiting && approval.data?.latestQa ? (
        <p className="mt-4 text-sm text-muted-foreground">
          QA approved by{" "}
          <span className="font-medium text-foreground">{approval.data.latestQa.reviewerName}</span>{" "}
          · {formatDateTime(approval.data.latestQa.createdAt)}
        </p>
      ) : null}
      {waiting && approval.data?.canApprove ? (
        <div className="mt-5 space-y-4">
          <label className="block space-y-2 text-sm font-medium">
            Manager review notes
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={2000}
              placeholder="Record your review of the checks, sources and supporting evidence"
              className="min-h-24 bg-white"
            />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            Final recommendation for the report
            <Textarea
              value={recommendation}
              onChange={(event) => setRecommendation(event.target.value)}
              maxLength={2000}
              placeholder="Write a factual recommendation within the approved verification scope"
              className="min-h-24 bg-white"
            />
          </label>
          {highRisk ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-950">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />
              I reviewed the high-risk findings, source evidence and documented clarifications.
            </label>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => mutation.mutate("APPROVED")}
              disabled={
                mutation.isPending ||
                notes.trim().length < 10 ||
                recommendation.trim().length < 10 ||
                (highRisk && !acknowledged)
              }
              loading={mutation.isPending && mutation.variables === "APPROVED"}
              className="rounded-full bg-emerald-800 hover:bg-emerald-900"
            >
              {mutation.isPending && mutation.variables === "APPROVED"
                ? "Saving…"
                : "Approve & prepare report"}
            </Button>
            <Button
              variant="outline"
              onClick={() => mutation.mutate("REWORK")}
              disabled={mutation.isPending || notes.trim().length < 10}
              loading={mutation.isPending && mutation.variables === "REWORK"}
              className="rounded-full"
            >
              Return to QA
            </Button>
          </div>
        </div>
      ) : waiting && !approval.isPending ? (
        <p className="mt-4 text-sm text-muted-foreground">
          An independent manager who did not record source responses, complete verification or
          perform QA must approve this case.
        </p>
      ) : null}
      {approval.data?.reviews.length ? (
        <div className="mt-5 space-y-3 border-t border-border/60 pt-4">
          {approval.data.reviews.slice(0, 3).map((review) => (
            <div key={review.id} className="rounded-2xl bg-white/80 p-3 text-sm">
              <p className="font-medium">
                {review.reviewerName} ·{" "}
                {review.decision === "APPROVED"
                  ? "Approved"
                  : review.decision === "REOPENED"
                    ? "Reopening approved"
                    : "Returned to QA"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDateTime(review.createdAt)}
              </p>
              <p className="mt-2 text-muted-foreground">{review.notes}</p>
            </div>
          ))}
        </div>
      ) : null}
      {isManager ? <CaseReopenForm item={item} /> : null}
    </section>
  );
}

function Stage({ label, done }: { label: string; done: boolean }) {
  const Icon = done ? CircleCheck : Clock3;
  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-3 py-3 text-xs font-medium ${done ? "bg-emerald-100/80 text-emerald-900" : "bg-white text-muted-foreground"}`}
    >
      <Icon className="size-4 shrink-0" />
      {label}
    </div>
  );
}
