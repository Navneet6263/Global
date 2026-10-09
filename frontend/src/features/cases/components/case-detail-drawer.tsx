"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { Button } from "@/components/ui/button";
import { ColumnPicker } from "@/components/table/column-picker";
import { useColumnChoice } from "@/components/table/use-column-choice";
import { FIELD_WORK_ENABLED } from "@/config/features";
import { useCaseDetail } from "../hooks/use-cases";
import { CaseSummaryPanel } from "./drawer/case-summary-panel";
import { CaseProgressSummary } from "../case-progress-summary";
import { FieldEvidenceGallery } from "../field-evidence-gallery";
import { CaseCandidateInvite } from "./drawer/case-candidate-invite";
import { CaseChecksPanel } from "./drawer/case-checks-panel";
import { CaseDocumentsPanel } from "./drawer/case-documents-panel";
import { AdminEscalateBar } from "./drawer/admin-escalate-bar";
import { CaseResponsibility } from "./drawer/case-responsibility";
import {
  CaseAssignmentsPanel,
  CaseClarificationsPanel,
  CaseReportsPanel,
  CaseTimelinePanel,
} from "./drawer/case-activity-panels";

interface CaseDetailDrawerProps {
  caseId: string | undefined;
  onClose: () => void;
}

/** Everything Case 360 can show; each person picks what they want to see. */
const SECTIONS = [
  { key: "summary", label: "Candidate & SLA summary" },
  { key: "responsibility", label: "Who is handling this case" },
  { key: "progress", label: "Progress by step" },
  { key: "invite", label: "Candidate invite" },
  { key: "checks", label: "Checks" },
  { key: "documents", label: "Documents" },
  { key: "clarifications", label: "Clarifications" },
  { key: "timeline", label: "Timeline" },
  { key: "assignments", label: "Assignments" },
  ...(FIELD_WORK_ENABLED ? [{ key: "field", label: "Field photos" } as const] : []),
  { key: "reports", label: "Reports" },
] as const;
type SectionKey = (typeof SECTIONS)[number]["key"];
const DEFAULT_SECTIONS: readonly SectionKey[] = SECTIONS.map((section) => section.key);
const TAB_KEYS: readonly SectionKey[] = [
  "checks",
  "documents",
  "clarifications",
  "timeline",
  "assignments",
  "field",
  "reports",
];

export function CaseDetailDrawer({ caseId, onClose }: CaseDetailDrawerProps) {
  const { data, isPending, isError, refetch } = useCaseDetail(caseId);
  const view = useColumnChoice("sapling.case360.sections.v1", SECTIONS, DEFAULT_SECTIONS);
  const tabs = SECTIONS.filter(
    (section) => TAB_KEYS.includes(section.key) && view.show(section.key),
  );

  return (
    <Sheet open={Boolean(caseId)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="border-b border-border">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="min-w-0">
              <SheetTitle className="text-base">Case 360</SheetTitle>
              <SheetDescription>
                Full verification context. Choose what you want to see with Customize.
              </SheetDescription>
            </div>
            <ColumnPicker
              options={SECTIONS}
              value={view.columns}
              defaults={DEFAULT_SECTIONS}
              fixedLabel="Escalation and case status"
              onChange={view.update}
              label="Customize"
              heading="Show in Case 360"
            />
          </div>
        </SheetHeader>

        <div className="space-y-4 p-4">
          {isPending ? <ListSkeleton rows={4} /> : null}
          {isError ? <ErrorState onRetry={() => void refetch()} /> : null}
          {!isPending && !isError && !data ? (
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm font-semibold text-foreground">Case detail is unavailable</p>
              <p className="text-xs text-muted-foreground">
                The case may have moved outside your scope or the link may no longer be valid.
              </p>
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          ) : null}
          {data ? (
            <>
              {caseId ? <AdminEscalateBar caseId={caseId} /> : null}
              {view.show("summary") ? <CaseSummaryPanel item={data} /> : null}
              {caseId && view.show("responsibility") ? (
                <CaseResponsibility caseId={caseId} />
              ) : null}
              {data.workflow && view.show("progress") ? (
                <CaseProgressSummary summary={data.workflow} />
              ) : null}
              {view.show("invite") ? <CaseCandidateInvite item={data} /> : null}

              {tabs.length ? (
                <Tabs key={tabs[0]!.key} defaultValue={tabs[0]!.key}>
                  <TabsList
                    className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl p-1.5 min-[400px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-7"
                    aria-label="Case sections"
                  >
                    {tabs.map((tab) => (
                      <TabsTrigger
                        key={tab.key}
                        value={tab.key}
                        className="min-h-10 min-w-0 rounded-xl px-1.5 text-xs data-[state=active]:bg-emerald-900 data-[state=active]:text-white"
                      >
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <TabsContent value="checks" className="pt-3">
                    <CaseChecksPanel item={data} />
                  </TabsContent>
                  <TabsContent value="documents" className="pt-3">
                    <CaseDocumentsPanel item={data} />
                  </TabsContent>
                  <TabsContent value="clarifications" className="pt-3">
                    <CaseClarificationsPanel item={data} />
                  </TabsContent>
                  <TabsContent value="timeline" className="pt-3">
                    <CaseTimelinePanel item={data} />
                  </TabsContent>
                  <TabsContent value="assignments" className="pt-3">
                    <CaseAssignmentsPanel item={data} />
                  </TabsContent>
                  <TabsContent value="reports" className="pt-3">
                    <CaseReportsPanel item={data} />
                  </TabsContent>
                  {FIELD_WORK_ENABLED ? (
                    <TabsContent value="field" className="pt-3">
                      <FieldEvidenceGallery visits={data.fieldVisits ?? []} />
                    </TabsContent>
                  ) : null}
                </Tabs>
              ) : (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  All sections are hidden. Use Customize to choose what to show.
                </p>
              )}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
