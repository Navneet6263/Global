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
        {open && (
          <Suspense
            fallback={
              <p className="p-5 text-sm text-muted-foreground">Loading source workspace…</p>
            }
          >
            <Methods
              caseId={caseId}
              checkId={checkId}
              readOnly={!canWrite || checkStatus === "COMPLETED"}
            />
          </Suspense>
        )}
      </DialogContent>
    </Dialog>
  );
}
