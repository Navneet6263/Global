import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { OpportunityFields } from "@/components/crm/OpportunityFields";
import { emptyOpportunityDraft, type OpportunityDraft } from "@/components/crm/crm-utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createOpportunity } from "@/lib/api/crm";

export function OpportunityDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<OpportunityDraft>({ ...emptyOpportunityDraft });
  const update = (key: keyof OpportunityDraft, value: string | number) =>
    setForm((current) => ({ ...current, [key]: value }));
  const mutation = useMutation({
    mutationFn: () =>
      createOpportunity({
        companyName: form.companyName.trim(),
        contactName: form.contactName.trim(),
        estimatedValue: Number(form.estimatedValue),
        probability: form.probability,
        ...(form.contactEmail.trim() ? { contactEmail: form.contactEmail.trim() } : {}),
        ...(form.contactPhone.trim() ? { contactPhone: form.contactPhone.trim() } : {}),
        ...(form.expectedCloseDate ? { expectedCloseDate: form.expectedCloseDate } : {}),
        ...(form.source.trim() ? { source: form.source.trim() } : {}),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      }),
    onSuccess: async () => {
      toast.success("Opportunity created");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["crm", "overview"] }),
        queryClient.invalidateQueries({ queryKey: ["crm", "opportunities"] }),
      ]);
      setForm({ ...emptyOpportunityDraft });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const valid =
    form.companyName.trim().length >= 2 &&
    form.contactName.trim().length >= 2 &&
    Number(form.estimatedValue) >= 0 &&
    form.estimatedValue !== "";
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) mutation.mutate();
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-xl overflow-y-auto border-l border-border bg-white p-0 sm:max-w-xl"
      >
        <div className="border-b border-border px-6 py-5">
          <SheetHeader>
            <div className="mb-1 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-orange-100 text-orange-700">
                <Sparkles className="h-4 w-4" />
              </span>
              <SheetTitle className="text-base">New opportunity</SheetTitle>
            </div>
            <SheetDescription>
              Capture a qualified prospect and initial commercial forecast.
            </SheetDescription>
          </SheetHeader>
        </div>
        <form onSubmit={submit} className="space-y-6 px-6 py-5">
          <OpportunityFields form={form} update={update} />
          <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-border bg-white py-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-10 rounded-xl border border-border px-4 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!valid || mutation.isPending}
              className="h-10 rounded-xl bg-foreground px-5 text-xs font-semibold text-background disabled:opacity-45"
            >
              {mutation.isPending ? "Creating…" : "Create opportunity"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
