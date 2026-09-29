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
import { HOLDER_LABEL } from "@/features/spoc-rm/config/spoc-meta";
import { date, label } from "@/features/spoc-rm/utils/spoc-format";
import { Fact, Section } from "@/features/spoc-rm/vendors/VendorDrawerParts";
import { useSupportEmployee } from "../hooks/use-support";
import { CASE_STATE_META, documentSummary } from "../support-model";
import {
  ChecksSection,
  ClarificationsSection,
  DocumentsSection,
  EmployeeRequestsSection,
  HistorySection,
  PendingSection,
} from "./EmployeeDetailSections";

/**
 * One employee's journey, read-only: where the case is, who holds it, what is
 * uploaded, what is pending and what is stuck. No contact details or files.
 */
export function SupportEmployeeDrawer({
  caseId,
  onClose,
}: {
  caseId: string | undefined;
  onClose: () => void;
}) {
  const detail = useSupportEmployee(caseId);
  const item = detail.data;
  const state = item ? CASE_STATE_META[item.state] : null;
  return (
    <Sheet open={Boolean(caseId)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {item ? item.candidateName : detail.isError ? "Employee unavailable" : "Loading"}
            {state ? <StatusBadge label={state.label} tone={state.tone} /> : null}
          </SheetTitle>
          <SheetDescription>
            {item ? `${item.caseNumber} · ${item.client.displayName}` : "Employee progress"}
          </SheetDescription>
        </SheetHeader>
        {detail.isError ? (
          <div className="p-5">
            <ErrorState
              description={detail.error.message}
              onRetry={() => void detail.refetch()}
              retrying={detail.isFetching}
            />
          </div>
        ) : !item ? (
          <div className="p-5">
            <ListSkeleton rows={4} />
          </div>
        ) : (
          <div className="space-y-6 p-5">
            <Section title="Current stage">
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <Fact term="Stage" value={label(item.status)} />
                <Fact term="With" value={HOLDER_LABEL[item.holderRole]} />
                <Fact term="Owner" value={item.currentOwner ?? "—"} />
                <Fact term="Due" value={`${date(item.dueAt)}${item.overdue ? " · overdue" : ""}`} />
                <Fact
                  term="Checks done"
                  value={`${item.checks.completed} / ${item.checks.total}`}
                />
                <Fact term="Documents" value={documentSummary(item.documents)} />
                <Fact term="Consent" value={label(item.consentStatus)} />
                <Fact term="Report" value={item.reportPublished ? "Published" : "Not yet"} />
              </dl>
            </Section>
            <PendingSection item={item} />
            <DocumentsSection item={item} />
            <ChecksSection item={item} />
            <ClarificationsSection item={item} />
            <HistorySection item={item} />
            <EmployeeRequestsSection item={item} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
