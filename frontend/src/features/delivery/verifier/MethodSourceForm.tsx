import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createVerificationMethod, type MethodName } from "@/lib/backend-api/verification-methods";

export function MethodSourceForm({
  checkId,
  method,
  alreadyTracked,
  onSaved,
}: {
  checkId: string;
  method: MethodName;
  alreadyTracked: boolean;
  onSaved: () => void;
}) {
  const [provider, setProvider] = useState("");
  const [sourceContact, setSourceContact] = useState("");
  const [dueAt, setDueAt] = useState("");
  const canAdd =
    !alreadyTracked &&
    (method === "MANUAL" || (provider.trim().length >= 2 && sourceContact.trim().length >= 2));
  const create = useMutation({
    mutationFn: () =>
      createVerificationMethod(checkId, {
        method,
        provider: provider.trim() || undefined,
        sourceContact: sourceContact.trim() || undefined,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
      }),
    onSuccess: () => {
      toast.success("Source request tracking added");
      setProvider("");
      setSourceContact("");
      setDueAt("");
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form
      className="space-y-3 rounded-2xl bg-muted/40 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (canAdd && !create.isPending) create.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-xs">
          Provider / source
          <Input
            value={provider}
            maxLength={160}
            required={method !== "MANUAL"}
            onChange={(event) => setProvider(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-xs">
          Authorised source contact
          <Input
            value={sourceContact}
            maxLength={300}
            required={method !== "MANUAL"}
            onChange={(event) => setSourceContact(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-xs">
          Response due
          <Input
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
          />
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        This records source work. It does not send an email or call a digital provider
        automatically.
      </p>
      {alreadyTracked && (
        <p className="text-xs text-amber-800">
          This method is already tracked. Record its response below.
        </p>
      )}
      <Button
        type="submit"
        size="sm"
        disabled={!canAdd || create.isPending}
        loading={create.isPending}
      >
        <Plus className="size-3.5" />
        {create.isPending ? "Adding…" : "Track source request"}
      </Button>
    </form>
  );
}
