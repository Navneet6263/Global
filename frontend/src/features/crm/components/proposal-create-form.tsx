import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createProposal,
  type ProposalCatalog,
  type ProposalLine,
} from "@/lib/backend-api/crm-proposals";

export function ProposalCreateForm({
  id,
  version,
  catalog,
  onSaved,
}: {
  id: string;
  version: number;
  catalog: ProposalCatalog[];
  onSaved: () => void;
}) {
  const [lines, setLines] = useState<ProposalLine[]>([]);
  const [terms, setTerms] = useState("");
  const [until, setUntil] = useState("");
  const update = (index: number, data: Partial<ProposalLine>) =>
    setLines((rows) => rows.map((row, i) => (i === index ? { ...row, ...data } : row)));
  const mutation = useMutation({
    mutationFn: () =>
      createProposal(id, {
        opportunityVersion: version,
        validUntil: new Date(until).toISOString(),
        terms: terms.trim(),
        lines,
      }),
    onSuccess: () => {
      toast.success("Proposal prepared for independent approval");
      onSaved();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <form
      className="space-y-3 rounded-2xl bg-violet-50/60 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <p className="text-xs text-muted-foreground">
        A versioned quote only. Existing case prices and client contracts stay unchanged.
      </p>
      {lines.map((line, index) => (
        <fieldset
          key={index}
          className="space-y-2 rounded-xl border border-violet-100 bg-white/80 p-3"
        >
          <legend className="px-1 text-xs font-semibold">Service {index + 1}</legend>
          <div className="flex gap-2">
            <select
              required
              aria-label={`Package ${index + 1}`}
              className="min-w-0 flex-1 rounded-xl border bg-white px-3 text-xs"
              value={line.packageId}
              onChange={(e) => {
                const item = catalog.find((p) => p.id === e.target.value);
                update(index, { packageId: e.target.value, unitPrice: item?.price ?? 0 });
              }}
            >
              <option value="">Choose package</option>
              {catalog
                .filter((p) => p.id === line.packageId || !lines.some((l) => l.packageId === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove service ${index + 1}`}
              onClick={() => setLines(lines.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-[11px]">
              Quantity
              <Input
                required
                type="number"
                min={1}
                max={10000}
                step={1}
                value={line.quantity}
                onChange={(e) => update(index, { quantity: Number(e.target.value) })}
              />
            </label>
            <label className="text-[11px]">
              Price ₹
              <Input
                required
                type="number"
                min={0.01}
                max={1000000}
                step="0.01"
                value={line.unitPrice}
                onChange={(e) => update(index, { unitPrice: Number(e.target.value) })}
              />
            </label>
            <label className="text-[11px]">
              Tax %
              <Input
                required
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={line.taxRate}
                onChange={(e) => update(index, { taxRate: Number(e.target.value) })}
              />
            </label>
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={lines.length >= Math.min(20, catalog.length)}
        onClick={() =>
          setLines([...lines, { packageId: "", quantity: 1, unitPrice: 0, taxRate: 0 }])
        }
      >
        <Plus className="size-3.5" /> Add service
      </Button>
      <label className="block space-y-1 text-xs">
        Valid until
        <Input
          required
          type="datetime-local"
          value={until}
          onChange={(e) => setUntil(e.target.value)}
        />
      </label>
      <label className="block space-y-1 text-xs">
        Commercial terms
        <Textarea
          required
          minLength={10}
          maxLength={2000}
          placeholder="Scope, billing terms, exclusions and agreed conditions"
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
        />
      </label>
      <Button
        size="sm"
        type="submit"
        disabled={mutation.isPending || !lines.length || terms.trim().length < 10}
        loading={mutation.isPending}
      >
        {mutation.isPending ? "Preparing…" : "Prepare draft proposal"}
      </Button>
    </form>
  );
}
