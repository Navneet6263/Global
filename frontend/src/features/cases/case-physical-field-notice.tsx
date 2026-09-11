import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPinned } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/api/auth";
import { transitionCase, type CaseDetail } from "@/lib/api/cases";
import { invalidateWorkflow } from "@/lib/api/invalidate-workflow";

export function CasePhysicalFieldNotice({
  item,
  onOpen,
}: {
  item: CaseDetail;
  onOpen: () => void;
}) {
  const cache = useQueryClient();
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const required = item.checks.some((check) => check.type === "ADDRESS");
  const visits = item.fieldVisits ?? [];
  const completed = visits.some((visit) => visit.status === "COMPLETED");
  const active = visits.filter((visit) => !["COMPLETED", "CANCELLED"].includes(visit.status));
  const missing = required && !completed;
  const blocked = missing || active.length > 0;
  const canReturn =
    item.status === "QA_REVIEW" &&
    blocked &&
    session.data?.roles.some((role) => ["OPS_MANAGER", "PLATFORM_ADMIN"].includes(role)) &&
    session.data.permissions.some((permission) => ["*", "case:transition"].includes(permission));
  const recovery = useMutation({
    mutationFn: () =>
      transitionCase(item.id, {
        status: "IN_PROGRESS",
        version: item.version,
        reason:
          "Required physical address verification is incomplete; returned from QA for field assignment and supervisor review.",
      }),
    onSuccess: async () => {
      toast.success("Returned to verification. Assign the required field visit below.");
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["case", item.id] }),
        invalidateWorkflow(cache),
      ]);
      onOpen();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (!required && !active.length) return null;
  const label = !blocked
    ? "Physical visit approved"
    : active.length
      ? "Field work pending"
      : "Physical visit assignment required";
  return (
    <section
      aria-label="Physical verification requirement"
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${blocked ? "border-warning/30 bg-warning-soft/70" : "border-mint/30 bg-mint-soft/60"}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <MapPinned className="mt-0.5 size-5 shrink-0" />
        <div>
          <h2 className="text-sm font-semibold">{label}</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {blocked
              ? "Address (physical) requires an on-site visit and independent supervisor approval before QA. Verifier document checks alone do not complete it."
              : "The physical visit is complete and supervisor-approved. Other verification and QA requirements still apply."}
          </p>
        </div>
      </div>
      {canReturn ? (
        <Button
          size="sm"
          loading={recovery.isPending}
          disabled={recovery.isPending}
          onClick={() => recovery.mutate()}
        >
          Return for field work
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={onOpen}>
          View field visits
        </Button>
      )}
    </section>
  );
}
