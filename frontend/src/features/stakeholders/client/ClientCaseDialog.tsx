import { lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";

const CaseDrawer = lazy(() =>
  import("./ClientCaseDrawer").then((module) => ({
    default: module.ClientCaseDrawer,
  })),
);

export function ClientCaseDialog({ caseId, onClose }: { caseId: string; onClose: () => void }) {
  return (
    <Suspense
      fallback={
        <div className="fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-lg">
          <span role="status" className="text-sm">
            Opening case workspace…
          </span>
          <Button size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      }
    >
      <CaseDrawer caseId={caseId} canRespond onClose={onClose} />
    </Suspense>
  );
}
