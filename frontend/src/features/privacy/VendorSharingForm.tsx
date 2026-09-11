import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createSharing, sharingCategories, type SharingDraft } from "./vendor-sharing-api";

export function VendorSharingForm({ onSaved }: { onSaved: () => void }) {
  const [draft, setDraft] = useState<SharingDraft>({
    recipient: "",
    purpose: "",
    agreementReference: "",
    scopeReference: "",
    categories: [],
    expiresAt: "",
  });
  const update = (data: Partial<SharingDraft>) => setDraft((row) => ({ ...row, ...data }));
  const save = useMutation({
    mutationFn: () =>
      createSharing({ ...draft, expiresAt: new Date(draft.expiresAt).toISOString() }),
    onSuccess: () => {
      onSaved();
      toast.success("Sharing scope proposed for independent review");
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <form
      className="space-y-3 rounded-2xl border bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs">
          Vendor / recipient
          <Input
            required
            minLength={2}
            maxLength={160}
            value={draft.recipient}
            onChange={(e) => update({ recipient: e.target.value })}
          />
        </label>
        <label className="text-xs">
          Client / case scope reference
          <Input
            required
            minLength={3}
            maxLength={200}
            value={draft.scopeReference}
            onChange={(e) => update({ scopeReference: e.target.value })}
          />
        </label>
        <label className="text-xs">
          Signed DPA / authority reference
          <Input
            required
            minLength={3}
            maxLength={300}
            value={draft.agreementReference}
            onChange={(e) => update({ agreementReference: e.target.value })}
          />
        </label>
        <label className="text-xs">
          Authority expires
          <Input
            required
            type="datetime-local"
            value={draft.expiresAt}
            onChange={(e) => update({ expiresAt: e.target.value })}
          />
        </label>
      </div>
      <label className="block text-xs">
        Specific sharing purpose
        <Textarea
          required
          minLength={10}
          maxLength={1000}
          value={draft.purpose}
          onChange={(e) => update({ purpose: e.target.value })}
        />
      </label>
      <fieldset>
        <legend className="mb-2 text-xs">Only the necessary data categories</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {sharingCategories.map((category) => (
            <label key={category} className="flex gap-2 rounded-xl bg-blue-50/70 p-3 text-xs">
              <input
                type="checkbox"
                checked={draft.categories.includes(category)}
                onChange={(e) =>
                  update({
                    categories: e.target.checked
                      ? [...draft.categories, category]
                      : draft.categories.filter((c) => c !== category),
                  })
                }
              />
              {category.replaceAll("_", " ")}
            </label>
          ))}
        </div>
      </fieldset>
      <Button
        size="sm"
        type="submit"
        disabled={save.isPending || !draft.categories.length}
        loading={save.isPending}
      >
        {save.isPending ? "Saving…" : "Propose sharing scope"}
      </Button>
    </form>
  );
}
