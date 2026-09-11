import {
  CheckCircle2,
  ClipboardCheck,
  FileText,
  History,
  MapPinned,
  MessageSquareText,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClarificationPanel } from "@/features/cases/case-clarification-panel";
import { formatDateTime, humanize } from "@/features/cases/case-detail-formatting";
import { Panel } from "@/features/cases/case-detail-ui";
import { ConsentPanel, DocumentPanel, ReportsPanel } from "@/features/cases/case-evidence-panels";
import { FieldVisitPanel } from "@/features/cases/case-field-visit-panel";
import { CaseManagerReviewPanel } from "./case-manager-review-panel";
import { CaseServiceScopePanel } from "./case-service-scope-panel";
import { CaseActivityPanel } from "./case-activity-panel";
import { CandidatePanel, CheckCard } from "@/features/cases/case-workflow-panels";
import type { CaseDetail } from "@/lib/api/cases";
import { useState } from "react";
import { CasePhysicalFieldNotice } from "./case-physical-field-notice";
import type { CaseWorkspaceTab } from "./case-workspace-search";

const triggerClass =
  "gap-2 rounded-xl px-3 py-2 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground";

export function CaseWorkspaceTabs({
  item,
  initialTab = "overview",
}: {
  item: CaseDetail;
  initialTab?: CaseWorkspaceTab;
}) {
  const [tab, setTab] = useState<string>(initialTab);
  const completedChecks = item.checks.filter((check) => check.status === "COMPLETED").length;
  const availableDocuments = item.documents.filter(
    (document) => document.status === "VERIFIED",
  ).length;
  const openClarifications = item.clarifications.filter(
    (clarification) => clarification.status !== "RESOLVED",
  ).length;
  const completedVisits = item.fieldVisits.filter((visit) => visit.status === "COMPLETED").length;

  return (
    <Tabs value={tab} onValueChange={setTab} className="space-y-5">
      <CasePhysicalFieldNotice item={item} onOpen={() => setTab("field-visits")} />
      <nav className="surface overflow-x-auto rounded-2xl p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabsList className="flex h-auto w-max min-w-full justify-start gap-1 bg-transparent p-0">
          <TabsTrigger className={triggerClass} value="overview">
            <UserRound className="size-3.5" aria-hidden /> Overview
          </TabsTrigger>
          <TabsTrigger className={triggerClass} value="checks">
            <ClipboardCheck className="size-3.5" aria-hidden /> Checks ({item.checks.length})
          </TabsTrigger>
          <TabsTrigger className={triggerClass} value="documents">
            <FileText className="size-3.5" aria-hidden /> Documents ({item.documents.length})
          </TabsTrigger>
          <TabsTrigger className={triggerClass} value="clarifications">
            <MessageSquareText className="size-3.5" aria-hidden /> Clarifications
          </TabsTrigger>
          <TabsTrigger className={triggerClass} value="field-visits">
            <MapPinned className="size-3.5" aria-hidden /> Field visits
          </TabsTrigger>
          <TabsTrigger className={triggerClass} value="reports">
            <ShieldCheck className="size-3.5" aria-hidden /> QA & reports
          </TabsTrigger>
          <TabsTrigger className={triggerClass} value="timeline">
            <History className="size-3.5" aria-hidden /> Timeline
          </TabsTrigger>
        </TabsList>
      </nav>

      <TabsContent value="overview" className="mt-0 space-y-5">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <WorkspaceMetric
            icon={ClipboardCheck}
            label="Checks completed"
            value={`${completedChecks}/${item.checks.length}`}
            detail="Verification bundle progress"
          />
          <WorkspaceMetric
            icon={FileText}
            label="Documents ready"
            value={`${availableDocuments}/${item.documents.length}`}
            detail="Evidence reviewed and accepted"
          />
          <WorkspaceMetric
            icon={MessageSquareText}
            label="Open clarifications"
            value={String(openClarifications)}
            detail="Candidate or client action"
          />
          <WorkspaceMetric
            icon={MapPinned}
            label="Field visits complete"
            value={`${completedVisits}/${item.fieldVisits.length}`}
            detail="Assigned on-ground visits"
          />
        </section>
        <CaseServiceScopePanel services={item.services} />
        {item.status === "MANAGER_REVIEW" ||
        item.status === "REPORT_PENDING" ||
        item.status === "PAYMENT_PENDING" ? (
          <CaseManagerReviewPanel item={item} />
        ) : null}
        <div className="grid items-start gap-5 xl:grid-cols-3">
          <CandidatePanel item={item} />
          <ConsentPanel item={item} />
          <ReportsPanel item={item} />
        </div>
      </TabsContent>

      <TabsContent value="checks" className="mt-0">
        <Panel title="Verification checks" subtitle="Assignment, current result and progress">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {item.checks.map((check) => (
              <CheckCard
                key={check.publicId}
                caseId={item.id}
                caseStatus={item.status}
                check={check}
              />
            ))}
          </div>
        </Panel>
      </TabsContent>

      <TabsContent value="documents" className="mt-0">
        <DocumentPanel item={item} />
      </TabsContent>

      <TabsContent value="clarifications" className="mt-0">
        <ClarificationPanel item={item} />
      </TabsContent>

      <TabsContent value="field-visits" className="mt-0">
        <FieldVisitPanel item={item} />
      </TabsContent>

      <TabsContent value="reports" className="mt-0 space-y-5">
        <CaseManagerReviewPanel item={item} />
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.7fr)]">
          <ReportsPanel item={item} />
          <ConsentPanel item={item} />
        </div>
      </TabsContent>

      <TabsContent value="timeline" className="mt-0 space-y-5">
        <CaseActivityPanel key={item.id} caseId={item.id} />
        <StatusHistory item={item} />
      </TabsContent>
    </Tabs>
  );
}

function WorkspaceMetric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="surface rounded-3xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <span className="grid size-10 place-items-center rounded-2xl bg-accent/60 text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function StatusHistory({ item }: { item: CaseDetail }) {
  return (
    <Panel title="Status history" subtitle="Immutable workflow transitions in newest-first order">
      <div className="space-y-0">
        {item.statusHistory.map((entry, index) => (
          <div
            key={`${entry.createdAt}-${index}`}
            className="relative grid gap-1 pb-6 pl-9 last:pb-0"
          >
            {index < item.statusHistory.length - 1 ? (
              <span className="absolute bottom-0 left-[0.68rem] top-5 w-px bg-border" />
            ) : null}
            <span className="absolute left-0 top-0 grid size-6 place-items-center rounded-full bg-accent text-primary ring-4 ring-background">
              <CheckCircle2 className="size-3.5" aria-hidden />
            </span>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{humanize(entry.toStatus)}</p>
              <time className="text-xs text-muted-foreground">
                {formatDateTime(entry.createdAt)}
              </time>
            </div>
            <p className="text-xs text-muted-foreground">
              {entry.fromStatus ? `${humanize(entry.fromStatus)} → ` : "Case started as "}
              {humanize(entry.toStatus)}
            </p>
            {entry.reason ? <p className="text-xs text-foreground/75">{entry.reason}</p> : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}
