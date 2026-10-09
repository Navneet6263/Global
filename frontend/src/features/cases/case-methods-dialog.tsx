import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getSession } from "@/lib/backend-api/auth";
import { humanize } from "./case-detail-formatting";

const Methods = lazy(() =>
  import("@/features/delivery/verifier/VerificationMethodsPanel").then((module) => ({
    default: module.VerificationMethodsPanel,
  })),
);
const SourceEmail = lazy(() =>
  import("@/features/delivery/verifier/SourceEmailPanel").then((module) => ({
    default: module.SourceEmailPanel,
  })),
);
const VendorPanel = lazy(() =>
  import("@/features/vendor-checks/CheckVendorPanel").then((module) => ({
    default: module.CheckVendorPanel,
  })),
);
const VerifiedDetails = lazy(() =>
  import("@/features/delivery/verifier/VerifiedDetailsPanel").then((module) => ({
    default: module.VerifiedDetailsPanel,
  })),
);

export function CaseMethodsDialog({
  caseId,
  checkId,
  checkType,
  checkStatus,
}: {
  caseId: string;
  checkId: string;
  checkType: string;
  checkStatus: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"methods" | "verified" | "email" | "vendor">("methods");
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const roles = session.data?.roles ?? [];
  if (
    !roles.some((role) =>
      ["PLATFORM_ADMIN", "OPS_MANAGER", "QA_REVIEWER", "VERIFIER"].includes(role),
    )
  )
    return null;
  const canWrite = roles.some((role) =>
    ["PLATFORM_ADMIN", "OPS_MANAGER", "VERIFIER"].includes(role),
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="mt-3">
          <FileSearch className="size-3.5" />
          Sources & methods
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] max-w-4xl overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>{humanize(checkType)} · source history</DialogTitle>
          <DialogDescription>
            Recorded method responses and the evidence used for this check.
          </DialogDescription>
        </DialogHeader>
        <div className="cmd-tabs" role="group" aria-label="Check workspace view">
          <button
            type="button"
            aria-pressed={view === "methods"}
            onClick={() => setView("methods")}
          >
            Sources & methods
          </button>
          <button
            type="button"
            aria-pressed={view === "verified"}
            onClick={() => setView("verified")}
          >
            Verified details (LHS / RHS)
          </button>
          <button type="button" aria-pressed={view === "email"} onClick={() => setView("email")}>
            Source email
          </button>
          <button type="button" aria-pressed={view === "vendor"} onClick={() => setView("vendor")}>
            Vendor
          </button>
        </div>
        {open && (
          <Suspense
            fallback={
              <p className="p-5 text-sm text-muted-foreground">Loading source workspace…</p>
            }
          >
            {view === "methods" ? (
              <Methods
                caseId={caseId}
                checkId={checkId}
                readOnly={!canWrite || checkStatus === "COMPLETED"}
              />
            ) : view === "vendor" ? (
              <VendorPanel checkId={checkId} />
            ) : view === "email" ? (
              <SourceEmail checkId={checkId} readOnly={!canWrite || checkStatus === "COMPLETED"} />
            ) : (
              <VerifiedDetails
                checkId={checkId}
                readOnly={!canWrite || checkStatus === "COMPLETED"}
              />
            )}
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  );
}
