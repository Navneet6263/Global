import { useState } from "react";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { StatusBadge } from "@/components/feedback/status-badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { statusTone } from "../config/spoc-meta";
import { useSpocCase } from "../hooks/use-spoc";
import { label } from "../utils/spoc-format";
import {
  SpocCaseChecks,
  SpocCaseFieldAndDocuments,
  SpocCaseReviews,
  SpocCaseSummary,
} from "./SpocCaseSections";
import { SpocCaseTimeline } from "./SpocCaseTimeline";

const tabs = [
  { value: "summary", label: "Summary" },
  { value: "checks", label: "Checks" },
  { value: "field", label: "Field & documents" },
  { value: "reviews", label: "Reviews & billing" },
  { value: "timeline", label: "Timeline" },
] as const;
type Tab = (typeof tabs)[number]["value"];

const triggerClass =
  "rounded-xl px-3 py-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground";

/** Read-only drill-down into one case: status, ownership, work items and history. No actions. */
export function SpocCaseDrawer({
  caseId,
  onClose,
}: {
  caseId: string | undefined;
  onClose: () => void;
}) {
  const detail = useSpocCase(caseId);
  const [tab, setTab] = useState<Tab>("summary");
  const item = detail.data;

  return (
    <Sheet open={Boolean(caseId)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-3xl">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {item?.candidateName ?? (detail.isError ? "Case unavailable" : "Loading case")}
            {item ? (
              <StatusBadge label={label(item.status)} tone={statusTone(item.status)} />
            ) : null}
          </SheetTitle>
          <SheetDescription>
            {item ? `${item.caseNumber} · view-only monitoring` : "Read-only case context"}
          </SheetDescription>
        </SheetHeader>
        <div className="p-5">
          {detail.isError ? (
            <ErrorState
              description={detail.error.message}
              onRetry={() => void detail.refetch()}
              retrying={detail.isFetching}
            />
          ) : !item ? (
            <ListSkeleton rows={6} />
          ) : (
            <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)} className="space-y-4">
              <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
                {tabs.map((entry) => (
                  <TabsTrigger key={entry.value} value={entry.value} className={triggerClass}>
                    {entry.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="summary">
                <SpocCaseSummary item={item} />
              </TabsContent>
              <TabsContent value="checks">
                <SpocCaseChecks item={item} />
              </TabsContent>
              <TabsContent value="field">
                <SpocCaseFieldAndDocuments item={item} />
              </TabsContent>
              <TabsContent value="reviews">
                <SpocCaseReviews item={item} />
              </TabsContent>
              <TabsContent value="timeline">
                <SpocCaseTimeline item={item} active={tab === "timeline"} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
