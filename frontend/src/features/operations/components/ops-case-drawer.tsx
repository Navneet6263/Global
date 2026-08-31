"use client";

import type { OpsCaseDetail } from "../contracts/case";
import {
  OPS_CHECK_STATUS_META,
  OPS_CLARIFICATION_STATE_META,
  OPS_DOCUMENT_STATUS_META,
  OPS_PRIORITY_META,
  OPS_SLA_META,
  OPS_STAGE_META,
} from "../contracts/case";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, formatDuration, formatRelativeToNow } from "@/lib/formatting";
import { useCaseAction } from "../hooks/use-operations";

interface OpsCaseDrawerProps {
  caseDetail: OpsCaseDetail | null | undefined;
  loading: boolean;
  open: boolean;
  onClose: () => void;
}

export function OpsCaseDrawer({ caseDetail, loading, open, onClose }: OpsCaseDrawerProps) {
  const action = useCaseAction();

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-[620px]">
        {loading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-6 w-52" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !caseDetail ? (
          <div className="space-y-3 p-6">
            <p className="text-sm font-semibold text-foreground">Case detail is unavailable</p>
            <p className="text-xs text-muted-foreground">
              The case may have moved outside your scope or the link may no longer be valid.
            </p>
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <SheetHeader className="border-b border-border px-6 py-5">
              <SheetTitle className="text-base">{caseDetail.candidateName}</SheetTitle>
              <p className="num text-xs text-muted-foreground">
                {caseDetail.caseNumber} · {caseDetail.clientName} · {caseDetail.packageName}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <StatusBadge
                  label={OPS_STAGE_META[caseDetail.stage].label}
                  tone={OPS_STAGE_META[caseDetail.stage].tone}
                />
                <StatusBadge
                  label={OPS_PRIORITY_META[caseDetail.priority].label}
                  tone={OPS_PRIORITY_META[caseDetail.priority].tone}
                  withDot={false}
                />
                <StatusBadge
                  label={OPS_SLA_META[caseDetail.slaState].label}
                  tone={OPS_SLA_META[caseDetail.slaState].tone}
                />
              </div>
            </SheetHeader>

            <div className="flex flex-wrap gap-2 border-b border-border px-6 py-3">
              <Button
                variant="outline"
                size="sm"
                disabled={action.isPending}
                onClick={() => action.mutate({ caseId: caseDetail.id, action: "escalate" })}
              >
                Escalate to client
              </Button>
            </div>

            <Tabs defaultValue="summary" className="px-6 py-4">
              <TabsList className="flex-wrap">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="checks">Checks</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="clarifications">Clarifications</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4 pt-4">
                {caseDetail.alerts.length > 0 ? (
                  <ul className="space-y-2">
                    {caseDetail.alerts.map((alert) => (
                      <li
                        key={alert.id}
                        className="rounded-xl border border-border bg-muted/40 px-3 py-2"
                      >
                        <StatusBadge label={alert.label} tone={alert.tone} />
                        <p className="mt-1.5 text-xs text-muted-foreground">{alert.detail}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <Field label="Operations owner" value={caseDetail.opsOwner ?? "Unassigned"} />
                  <Field label="Verifier" value={caseDetail.verifier ?? "Not allocated"} />
                  <Field label="Branch" value={`${caseDetail.branch} · ${caseDetail.city}`} />
                  <Field
                    label="SLA remaining"
                    value={
                      caseDetail.slaMinutesRemaining <= 0
                        ? `Overdue ${formatDuration(-caseDetail.slaMinutesRemaining)}`
                        : formatDuration(caseDetail.slaMinutesRemaining)
                    }
                  />
                  <Field label="Candidate email" value={caseDetail.candidateEmail} />
                  <Field label="Candidate mobile" value={caseDetail.candidateMobile} />
                  <Field label="Created" value={formatDateTime(caseDetail.createdAt)} />
                  <Field label="Next action" value={caseDetail.nextAction} />
                </dl>
              </TabsContent>

              <TabsContent value="checks" className="space-y-2 pt-4">
                {caseDetail.checks.map((check) => (
                  <div
                    key={check.id}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-border px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-foreground">{check.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {check.verifier ?? "Unassigned"} · {check.sourceSummary}
                      </p>
                    </div>
                    <StatusBadge
                      label={OPS_CHECK_STATUS_META[check.status].label}
                      tone={OPS_CHECK_STATUS_META[check.status].tone}
                    />
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="documents" className="space-y-2 pt-4">
                <div className="rounded-xl border border-border px-3 py-2.5 text-xs">
                  <p className="font-medium text-foreground">Consent</p>
                  <p className="text-muted-foreground">
                    {caseDetail.consent.status} via {caseDetail.consent.channel} · requested{" "}
                    {formatRelativeToNow(caseDetail.consent.requestedAt)}
                  </p>
                </div>
                {caseDetail.documents.map((document) => (
                  <div
                    key={document.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2.5"
                  >
                    <div>
                      <p className="text-[13px] text-foreground">{document.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatRelativeToNow(document.updatedAt)}
                        {document.note ? ` · ${document.note}` : ""}
                      </p>
                    </div>
                    <StatusBadge
                      label={OPS_DOCUMENT_STATUS_META[document.status].label}
                      tone={OPS_DOCUMENT_STATUS_META[document.status].tone}
                    />
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="clarifications" className="space-y-2 pt-4">
                {caseDetail.clarifications.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No clarifications raised on this case.
                  </p>
                ) : (
                  caseDetail.clarifications.map((clarification) => (
                    <div
                      key={clarification.id}
                      className="space-y-1.5 rounded-xl border border-border px-3 py-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[13px] font-medium text-foreground">
                          {clarification.subject}
                        </p>
                        <StatusBadge
                          label={OPS_CLARIFICATION_STATE_META[clarification.state].label}
                          tone={OPS_CLARIFICATION_STATE_META[clarification.state].tone}
                        />
                      </div>
                      {clarification.messages.map((message) => (
                        <p key={message.id} className="text-[11px] text-muted-foreground">
                          <span className="font-medium text-foreground">{message.author}:</span>{" "}
                          {message.body}
                        </p>
                      ))}
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="timeline" className="space-y-3 pt-4">
                {caseDetail.timeline.map((event) => (
                  <div key={event.id} className="border-l-2 border-border pl-3">
                    <p className="text-[13px] font-medium text-foreground">{event.label}</p>
                    <p className="text-[11px] text-muted-foreground">{event.detail}</p>
                    <p className="text-[11px] text-muted-foreground/80">
                      {formatDateTime(event.at)} · {event.actor}
                    </p>
                  </div>
                ))}
              </TabsContent>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-foreground">{value}</dd>
    </div>
  );
}
