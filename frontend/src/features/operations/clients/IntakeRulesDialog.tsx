import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { listUsers } from "@/lib/backend-api/users";
import { setIntakeRules, type ClientRmRow } from "@/lib/backend-api/workflow";

/**
 * Per-company intake rules from the BGV process document: Route A (the client reviews
 * its candidate's submission first) and auto-assignment ("XYZ client goes to ABC").
 */
export function IntakeRulesDialog({
  company,
  onClose,
}: {
  company: ClientRmRow;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const rules = company.intakeRules;
  const [reviewFirst, setReviewFirst] = useState(rules?.clientReviewFirst ?? false);
  const [dataEntry, setDataEntry] = useState(rules?.defaultDataEntry?.id ?? "");
  const people = useQuery({
    queryKey: ["users", "data-entry-options"],
    queryFn: () => listUsers({ role: "DATA_ENTRY", status: "ACTIVE", pageSize: 100 }),
    staleTime: 60_000,
  });
  const save = useMutation({
    mutationFn: () =>
      setIntakeRules(company.id, {
        version: company.version,
        clientReviewFirst: reviewFirst,
        defaultDataEntryUserId: dataEntry || null,
      }),
    onSuccess: async () => {
      toast.success(`Intake rules saved for ${company.name}`);
      await queryClient.invalidateQueries({ queryKey: ["workflow", "client-rms"] });
      onClose();
    },
    onError: (error: Error) => toast.error("Not saved", { description: error.message }),
  });
  const changed =
    reviewFirst !== (rules?.clientReviewFirst ?? false) ||
    dataEntry !== (rules?.defaultDataEntry?.id ?? "");
  return (
    <Dialog open onOpenChange={(open) => (!open && !save.isPending ? onClose() : undefined)}>
      <DialogContent className="ops-dialog sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Intake rules · {company.name}</DialogTitle>
          <DialogDescription>
            What happens when this company&apos;s candidate presses Complete.
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-start justify-between gap-4 rounded-xl border border-border p-3">
          <span>
            <strong className="block text-sm">Client reviews the submission first</strong>
            <span className="block text-xs text-muted-foreground">
              Route A: the company admin approves or returns the candidate&apos;s documents before
              Sapling starts. Off = Route B, straight to the RM.
            </span>
          </span>
          <Switch
            checked={reviewFirst}
            onCheckedChange={setReviewFirst}
            aria-label="Client reviews the submission first"
          />
        </label>
        <label className="ops-field">
          <span>Auto-assign Data Entry to</span>
          <select
            value={dataEntry}
            onChange={(event) => setDataEntry(event.target.value)}
            aria-label="Auto-assign Data Entry to"
            disabled={people.isPending}
          >
            <option value="">No rule — the RM assigns each case</option>
            {(people.data?.items ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
              </option>
            ))}
          </select>
        </label>
        <p className="ops-dialog-note">
          Every change is recorded in the audit trail. Cases already with Data Entry are not moved.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button disabled={!changed} loading={save.isPending} onClick={() => save.mutate()}>
            Save rules
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
