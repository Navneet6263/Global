import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { reportPreviewApi, type ReportDetails } from "@/lib/backend-api/report-preview";

/** Date of joining and client process for the report header. */
export function ReportHeaderDetails({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const details = useQuery({
    queryKey: ["report-details", caseId],
    queryFn: () => reportPreviewApi.details(caseId),
  });
  if (details.isPending)
    return <p className="text-[12.5px] text-slate-500">Loading report details…</p>;
  if (details.isError) return <p className="text-[12.5px] text-red-600">{details.error.message}</p>;
  return (
    <HeaderForm
      key={`${details.data.joiningDate}-${details.data.clientProcess}`}
      caseId={caseId}
      data={details.data}
      onSaved={async () => {
        await queryClient.invalidateQueries({ queryKey: ["report-details", caseId] });
        await queryClient.invalidateQueries({ queryKey: ["report-preview", caseId] });
        await queryClient.refetchQueries({ queryKey: ["report-preview", caseId] });
        await queryClient.invalidateQueries({ queryKey: ["report-view", caseId] });
      }}
    />
  );
}

function HeaderForm({
  caseId,
  data,
  onSaved,
}: {
  caseId: string;
  data: ReportDetails;
  onSaved: () => Promise<void>;
}) {
  const [joiningDate, setJoiningDate] = useState(data.joiningDate ?? "");
  const [clientProcess, setClientProcess] = useState(data.clientProcess ?? "");
  const changed =
    joiningDate !== (data.joiningDate ?? "") || clientProcess !== (data.clientProcess ?? "");
  const save = useMutation({
    mutationFn: () =>
      reportPreviewApi.saveDetails(caseId, {
        joiningDate: joiningDate || null,
        clientProcess: clientProcess.trim() || null,
      }),
    onSuccess: async () => {
      toast.success("Report details saved", { description: "The preview is updated." });
      await onSaved();
    },
    onError: (error: Error) => toast.error("Not saved", { description: error.message }),
  });
  const input =
    "h-9 w-full rounded-lg border border-slate-200 px-2.5 text-[13px] outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500";
  return (
    <form
      aria-label="Report header details"
      className="grid gap-3 rounded-xl border border-slate-200 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div>
        <h3 className="text-[13px] font-semibold text-slate-900">Report header</h3>
        <p className="text-[12px] text-slate-500">
          {data.canEdit
            ? "Printed on the executive summary."
            : "Only Operations, the case RM or its Data Entry can change these before approval."}
        </p>
      </div>
      <label className="grid gap-1 text-[12.5px] font-medium text-slate-700">
        Date of joining
        <input
          type="date"
          value={joiningDate}
          disabled={!data.canEdit}
          onChange={(event) => setJoiningDate(event.target.value)}
          className={input}
        />
      </label>
      <label className="grid gap-1 text-[12.5px] font-medium text-slate-700">
        Client process / reference
        <input
          value={clientProcess}
          maxLength={80}
          disabled={!data.canEdit}
          placeholder="e.g. ABC-1212"
          onChange={(event) => setClientProcess(event.target.value)}
          className={input}
        />
      </label>
      {data.canEdit ? (
        <Button type="submit" size="sm" disabled={!changed} loading={save.isPending}>
          Save and refresh preview
        </Button>
      ) : null}
    </form>
  );
}
