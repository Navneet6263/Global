import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CaseDetail } from "@/lib/api/cases";
import { invalidateWorkflow } from "@/lib/api/invalidate-workflow";
import { reopenCase } from "@/lib/backend-api/case-approvals";
import { humanize } from "./case-detail-formatting";

export function CaseReopenForm({ item }: { item: CaseDetail }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const mutation = useMutation({
    mutationFn: () =>
      reopenCase(item.id, { caseVersion: item.version, notes: notes.trim(), checkIds: selected }),
    onSuccess: () => {
      toast.success("Reopening approved. Selected checks returned for verification.");
      setOpen(false);
      setNotes("");
      setSelected([]);
      void invalidateWorkflow(client);
      void client.invalidateQueries({ queryKey: ["case-approval", item.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="mt-5 border-t border-border/60 pt-4">
      <Button variant="outline" onClick={() => setOpen(!open)} className="gap-2 rounded-full">
        <RotateCcw className="size-4" /> {open ? "Cancel reopening" : "Approve case reopening"}
      </Button>
      {open ? (
        <div className="mt-4 space-y-3 rounded-2xl bg-violet-50/80 p-4">
          <p className="text-sm text-violet-950">
            Select the checks that need fresh verification. Previous reports remain in history and
            are superseded.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {item.checks.map((check) => (
              <label
                key={check.publicId}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-white p-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(check.publicId)}
                  onChange={(event) =>
                    setSelected((current) =>
                      event.target.checked
                        ? [...current, check.publicId]
                        : current.filter((id) => id !== check.publicId),
                    )
                  }
                />
                {humanize(check.type)}
              </label>
            ))}
          </div>
          <label className="block space-y-2 text-sm font-medium">
            Reason for reopening
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={2000}
              placeholder="Explain the correction and why fresh verification is needed"
              className="bg-white"
            />
          </label>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !selected.length || notes.trim().length < 10}
            loading={mutation.isPending}
          >
            {mutation.isPending
              ? "Approving…"
              : `Reopen ${selected.length} selected check${selected.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
