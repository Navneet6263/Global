import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/api/auth";
import { getCase } from "@/lib/backend-api/cases";
import { EscalateDialog } from "@/features/operations/workspace/OpsCaseDialogs";
import { istDateTime } from "@/features/operations/workspace/ops-queue-model";

const CLOSED = ["COMPLETED", "CLOSED", "CANCELLED"];

/**
 * Platform Admin oversight in Case 360: everything is read-only, and a live case can be
 * escalated so Operations handles it on high priority.
 */
export function AdminEscalateBar({ caseId }: { caseId: string }) {
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const viewOnly = session.data?.viewOnly === true;
  const item = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCase(caseId),
    enabled: viewOnly,
  });
  const [open, setOpen] = useState(false);
  if (!viewOnly || !item.data) return null;
  const data = item.data;
  const escalatedAt = data.workflow?.escalatedAt;
  const live = !CLOSED.includes(data.status);
  return (
    <section
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3 ${
        escalatedAt ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"
      }`}
      aria-label="Oversight"
    >
      <div className="min-w-0 text-[13px]">
        {escalatedAt ? (
          <p className="flex items-center gap-2 font-semibold text-amber-900">
            <TriangleAlert className="size-4" aria-hidden />
            Escalated {istDateTime(escalatedAt)}
            {data.workflow?.escalatedBy ? ` by ${data.workflow.escalatedBy.displayName}` : ""}
          </p>
        ) : (
          <p className="flex items-center gap-2 font-semibold text-slate-700">
            <Eye className="size-4" aria-hidden /> View-only oversight
          </p>
        )}
        <p className="mt-0.5 text-slate-600">
          {escalatedAt
            ? (data.workflow?.escalationNote ?? "Operations is handling it on high priority.")
            : "You can see everything. Escalate to move this case to Urgent for Operations and the RM."}
        </p>
      </div>
      {live && !escalatedAt ? (
        <Button size="sm" variant="outline" className="ops-escalate" onClick={() => setOpen(true)}>
          <TriangleAlert className="size-3.5" aria-hidden /> Escalate
        </Button>
      ) : null}
      {open ? (
        <EscalateDialog
          internal
          target={{
            id: data.id,
            caseNumber: data.caseNumber,
            candidate: data.subject.fullName,
            clientId: data.client.publicId,
            clientName: data.client.displayName,
            version: data.version,
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </section>
  );
}
