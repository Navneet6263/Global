import { useMutation } from "@tanstack/react-query";
import { FileClock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadInterimReport } from "@/lib/api/reports";

const NOT_IN_PROGRESS = ["DRAFT", "COMPLETED", "CLOSED", "CANCELLED"];

/** Interim (WIP) report: finished checks so far, while the case is still in verification. */
export function InterimReportButton({
  item,
}: {
  item: { id: string; caseNumber: string; status: string };
}) {
  const download = useMutation({
    mutationFn: () => downloadInterimReport(item.id, item.caseNumber),
    onSuccess: () =>
      toast.success("Interim report downloaded", {
        description: "It shows only the checks finished so far.",
      }),
    onError: (error: Error) =>
      toast.error("Interim report not available", { description: error.message }),
  });
  if (NOT_IN_PROGRESS.includes(item.status)) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-lg"
      disabled={download.isPending}
      onClick={() => download.mutate()}
      title="Download a work-in-progress report of the checks finished so far"
    >
      <FileClock className="size-4" />
      {download.isPending ? "Preparing…" : "Interim report"}
    </Button>
  );
}
