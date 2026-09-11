import { useState } from "react";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/backend-api/client";
import { formatInr } from "@/lib/formatting";
import { useDebouncedValue } from "@/lib/use-debounced-value";

interface CreditClient {
  id: string;
  displayName: string;
  version: number;
  outstanding: string;
  overLimit: boolean;
  creditLimit: string | null;
  creditHold: boolean;
  creditControlReason: string | null;
}
export function CreditControl({
  canWrite,
  expanded = false,
}: {
  canWrite: boolean;
  expanded?: boolean;
}) {
  const [opened, setOpened] = useState(false);
  return (
    <section className="rounded-3xl border border-amber-100 bg-amber-50/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <ShieldAlert className="size-4 text-amber-700" />
            Client credit controls
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Invoice balance alerts and explicit new-case holds.
          </p>
        </div>
        {!expanded && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpened(!opened)}
            aria-expanded={opened}
          >
            {opened ? "Close controls" : "Manage credit"}
          </Button>
        )}
      </div>
      {(expanded || opened) && <CreditWorkspace canWrite={canWrite} />}
    </section>
  );
}
function CreditWorkspace({ canWrite }: { canWrite: boolean }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<CreditClient | null>(null);
  const term = useDebouncedValue(search, 300);
  const query = useQuery({
    queryKey: ["credit-control", term, page],
    queryFn: () =>
      apiRequest<{ total: number; items: CreditClient[] }>(
        `/finance/credit-control?${new URLSearchParams({ page: String(page), ...(term ? { search: term } : {}) })}`,
      ),
    placeholderData: keepPreviousData,
  });
  return (
    <div className="mt-4 space-y-3">
      <p className="rounded-xl bg-white/70 p-3 text-xs text-muted-foreground">
        Limits compare outstanding INR invoices only, excluding unbilled work. Exceeding a limit is
        an alert, not an automatic hold. Only an explicit Finance hold blocks new case intake.
        Existing work and payment-based report release stay unchanged.
      </p>
      <Input
        value={search}
        maxLength={120}
        placeholder="Search client organisation"
        aria-label="Search credit-control clients"
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />
      {query.isPending && (
        <p className="text-xs" role="status">
          Loading balances…
        </p>
      )}
      {query.isError && (
        <p role="alert" className="text-xs text-destructive">
          {query.error.message}
          <Button size="sm" variant="ghost" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {query.data?.items.map((client) => (
        <article
          key={client.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3"
        >
          <div>
            <h4 className="text-sm font-medium">{client.displayName}</h4>
            <p className="mt-1 text-xs text-muted-foreground">
              Outstanding {formatInr(Number(client.outstanding))} · Limit{" "}
              {client.creditLimit === null ? "Not set" : formatInr(Number(client.creditLimit))}
            </p>
            {client.creditControlReason && (
              <p className="mt-1 text-xs">{client.creditControlReason}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-1 text-[10px] ${client.creditHold ? "bg-rose-50 text-rose-700" : client.overLimit ? "bg-amber-100 text-amber-800" : "bg-mint-soft text-mint-deep"}`}
            >
              {client.creditHold ? "Intake held" : client.overLimit ? "Over limit" : "No hold"}
            </span>
            {canWrite && (
              <Button
                size="sm"
                variant="outline"
                disabled={query.isPlaceholderData}
                onClick={() => setSelected(client)}
              >
                Review
              </Button>
            )}
          </div>
        </article>
      ))}
      {query.data && !query.data.items.length && <p className="text-xs">No matching clients.</p>}
      {query.data && query.data.total > 12 && (
        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="ghost"
            disabled={page === 1 || query.isFetching}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs">
            {page} / {Math.ceil(query.data.total / 12)}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={page * 12 >= query.data.total || query.isFetching}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
      {selected && (
        <CreditDecision key={selected.id} client={selected} close={() => setSelected(null)} />
      )}
    </div>
  );
}
function CreditDecision({ client, close }: { client: CreditClient; close: () => void }) {
  const cache = useQueryClient();
  const [limit, setLimit] = useState(client.creditLimit ?? "");
  const [hold, setHold] = useState(client.creditHold);
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      apiRequest(`/finance/credit-control/${client.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          version: client.version,
          creditLimit: limit.trim() ? Number(limit) : null,
          creditHold: hold,
          reason,
        }),
      }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["credit-control"] });
      void cache.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Credit decision saved and audited");
      close();
    },
    onError: (error) => {
      toast.error(error.message);
      void cache.invalidateQueries({ queryKey: ["credit-control"] });
    },
  });
  return (
    <form
      className="space-y-3 rounded-2xl border border-amber-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
    >
      <h4 className="text-sm font-semibold">Credit decision · {client.displayName}</h4>
      <label className="block text-xs">
        Credit limit (₹, blank means not set)
        <Input
          type="number"
          min={0}
          step="0.01"
          max={999999999999}
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
        />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={hold} onChange={(e) => setHold(e.target.checked)} />
        Hold new verification intake for this client
      </label>
      {hold && (
        <p className="text-xs text-rose-700">
          Client Admin, Operations and Admin will not be able to submit new cases for this
          organisation until Finance releases the hold.
        </p>
      )}
      <label className="block text-xs">
        Decision rationale
        <Textarea
          required
          minLength={10}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={mutation.isPending || reason.trim().length < 10}
          loading={mutation.isPending}
        >
          {mutation.isPending ? "Saving…" : "Confirm credit decision"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={close}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
