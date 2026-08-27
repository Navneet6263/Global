"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { useCaseDetail } from "../hooks/use-cases";
import { CaseSummaryPanel } from "./drawer/case-summary-panel";
import { CaseChecksPanel } from "./drawer/case-checks-panel";
import { CaseDocumentsPanel } from "./drawer/case-documents-panel";
import {
  CaseAssignmentsPanel,
  CaseClarificationsPanel,
  CaseReportsPanel,
  CaseTimelinePanel,
} from "./drawer/case-activity-panels";

interface CaseDetailDrawerProps {
  caseId: string | undefined;
  onClose: () => void;
  onAction: (action: string) => void;
}

const TABS = [
  { value: "checks", label: "Checks" },
  { value: "documents", label: "Documents" },
  { value: "clarifications", label: "Clarifications" },
  { value: "timeline", label: "Timeline" },
  { value: "assignments", label: "Assignments" },
  { value: "reports", label: "Reports" },
] as const;

export function CaseDetailDrawer({ caseId, onClose, onAction }: CaseDetailDrawerProps) {
  const { data, isPending, isError, refetch } = useCaseDetail(caseId);

  return (
    <Sheet open={Boolean(caseId)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="text-base">Case 360</SheetTitle>
          <SheetDescription>
            Full verification context: checks, documents, clarifications and audit timeline.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 p-4">
          {isPending ? <ListSkeleton rows={4} /> : null}
          {isError ? <ErrorState onRetry={() => void refetch()} /> : null}
          {data ? (
            <>
              <CaseSummaryPanel item={data} />

              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => onAction("Reassign case")}>
                  Reassign owner
                </Button>
                <Button variant="outline" size="sm" onClick={() => onAction("Raise clarification")}>
                  Raise clarification
                </Button>
                <Button variant="outline" size="sm" onClick={() => onAction("Escalate to QA")}>
                  Escalate to QA
                </Button>
              </div>

              <Tabs defaultValue="checks">
                <TabsList className="w-full flex-wrap justify-start">
                  {TABS.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
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
              </Tabs>
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
