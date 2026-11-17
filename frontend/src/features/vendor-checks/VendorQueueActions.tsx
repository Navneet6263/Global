import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Undo2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { vendorWorkApi, type VendorJobDetail } from "@/lib/backend-api/vendor-checks";

/**
 * Vendor-side actions of the open queue: return a picked check to the queue (with a
 * reason, before any proof), and the vendor Team Leader's review of a member's work.
 */
export function VendorQueueActions({ job }: { job: VendorJobDetail }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"release" | "return" | null>(null);
  const [text, setText] = useState("");
  const act = useMutation({
    mutationFn: async (kind: "release" | "approve" | "return"): Promise<unknown> => {
      if (kind === "release") return vendorWorkApi.release(job.id, job.version, text.trim());
      return vendorWorkApi.teamReview(job.id, {
        version: job.version,
        decision: kind === "approve" ? "APPROVE" : "RETURN",
        note: text.trim() || undefined,
      });
    },
    onSuccess: async (_, kind) => {
      toast.success(
        {
          release: "Returned to the open queue",
          approve: "Approved — sent to Sapling Global for review",
          return: "Sent back to your team member",
        }[kind],
      );
      setMode(null);
      setText("");
      await queryClient.invalidateQueries({ queryKey: ["vendor-checks"] });
      await queryClient.invalidateQueries({ queryKey: ["vendor-queue"] });
    },
    onError: (error: Error) => toast.error("Not done", { description: error.message }),
  });
  if (!job.canRelease && !job.canTeamReview) return null;
  return (
    <section
      className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-[13px]"
      aria-label={job.canTeamReview ? "Team Leader review" : "Return to the queue"}
    >
      {job.canTeamReview ? (
        <p className="flex items-center gap-2 font-semibold text-slate-800">
          <UsersRound className="size-4 text-blue-700" aria-hidden />
          {job.handler?.name ?? "Your team member"} finished this check. Check it before it goes to
          Sapling Global.
        </p>
      ) : (
        <p className="text-slate-600">
          Cannot do this one? Return it to the open queue so another vendor can pick it.
        </p>
      )}
      {mode ? (
        <label className="grid gap-1.5">
          <span className="font-medium text-slate-700">
            {mode === "release" ? "Why are you returning it? *" : "What should be fixed? *"}
          </span>
          <textarea
            rows={2}
            value={text}
            maxLength={1000}
            onChange={(event) => setText(event.target.value)}
            aria-label={mode === "release" ? "Reason for returning it" : "What to fix"}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2"
          />
        </label>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {mode ? (
          <>
            <Button size="sm" variant="outline" onClick={() => setMode(null)}>
              Back
            </Button>
            <Button
              size="sm"
              variant={mode === "release" ? "destructive" : "default"}
              disabled={text.trim().length < 10}
              loading={act.isPending}
              onClick={() => act.mutate(mode)}
            >
              <Undo2 aria-hidden />
              {mode === "release" ? "Return to the queue" : "Send back to member"}
            </Button>
          </>
        ) : job.canTeamReview ? (
          <>
            <Button size="sm" variant="outline" onClick={() => setMode("return")}>
              <Undo2 aria-hidden /> Send back
            </Button>
            <Button size="sm" loading={act.isPending} onClick={() => act.mutate("approve")}>
              <BadgeCheck aria-hidden /> Approve and send to Sapling Global
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setMode("release")}>
            <Undo2 aria-hidden /> Return to the queue
          </Button>
        )}
      </div>
    </section>
  );
}
