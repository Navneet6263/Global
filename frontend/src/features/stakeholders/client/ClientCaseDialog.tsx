import { lazy, Suspense } from "react";
import { Button } from "@/kit";
import type { CaseTabName } from "./client-queue-model";

const CaseDrawer = lazy(() =>
  import("./ClientCaseDrawer").then((module) => ({
    default: module.ClientCaseDrawer,
  })),
);

export function ClientCaseDialog({
  caseId,
  tab,
  onClose,
}: {
  caseId: string;
  tab?: CaseTabName;
  onClose: () => void;
}) {
  return (
    <Suspense
      fallback={
        <div className="fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-lg border border-line bg-surface shadow-soft p-4 text-ink shadow-lg">
          <span role="status" className="text-sm">
            Opening case workspace…
          </span>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <CaseDrawer caseId={caseId} initialTab={tab} canRespond onClose={onClose} />
    </Suspense>
  );
}
