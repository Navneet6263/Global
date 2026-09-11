import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/formatting";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import {
  listSharing,
  decideSharing,
  sharingEvents,
  type SharingRecord,
} from "./vendor-sharing-api";
import { VendorSharingForm } from "./VendorSharingForm";

export function VendorSharingRegister() {
  const [opened, setOpened] = useState(false);
  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Building2 className="size-4 text-blue-700" />
            Vendor data-sharing register
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Recipient, scope, authority, expiry and independent decisions.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpened(!opened)}
          aria-expanded={opened}
        >
          {opened ? "Close register" : "Open register"}
        </Button>
      </div>
      {opened && <SharingWorkspace />}
    </section>
  );
}
function SharingWorkspace() {
  const cache = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const term = useDebouncedValue(search, 300);
  const query = useQuery({
    queryKey: ["vendor-sharing", term, page],
    queryFn: () => listSharing(page, term),
    placeholderData: keepPreviousData,
  });
  const refresh = () => {
    void cache.invalidateQueries({ queryKey: ["vendor-sharing"] });
    void cache.invalidateQueries({ queryKey: ["sharing-events"] });
  };
  return (
    <div className="mt-4 space-y-3">
      <p className="rounded-xl bg-white/80 p-3 text-xs text-muted-foreground">
        An authority register, not a transfer tool. Approval does not send documents or give the
        vendor a login. Confirm actual sharing controls and signed agreements separately. Expired
        authority is displayed as expired even before anyone updates the record.
      </p>
      <div className="flex flex-wrap gap-2">
        <Input
          className="sm:max-w-sm"
          maxLength={160}
          aria-label="Search sharing recipient"
          placeholder="Search recipient"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Button size="sm" variant="outline" onClick={() => setCreating(!creating)}>
          {creating ? "Cancel new scope" : "New sharing scope"}
        </Button>
      </div>
      {creating && (
        <VendorSharingForm
          onSaved={() => {
            setCreating(false);
            setPage(1);
            refresh();
          }}
        />
      )}
      {query.isPending && (
        <p role="status" className="text-xs">
          Loading sharing register…
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
      {query.data?.items.map((item) => (
        <SharingCard key={item.id} row={item} onSaved={refresh} />
      ))}
      {query.data && !query.data.items.length && (
        <p className="text-xs">No matching sharing records.</p>
      )}
      {query.data && query.data.total > 12 && (
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            disabled={page === 1 || query.isFetching}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs">
            {page} / {Math.ceil(query.data.total / 12)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page * 12 >= query.data.total || query.isFetching}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
function SharingCard({ row, onSaved }: { row: SharingRecord; onSaved: () => void }) {
  const [history, setHistory] = useState(false);
  const [action, setAction] = useState("");
  const [reason, setReason] = useState("");
  const save = useMutation({
    mutationFn: () => decideSharing(row, action, reason),
    onSuccess: () => {
      setAction("");
      setReason("");
      onSaved();
      toast.success("Sharing decision recorded");
    },
    onError: (error) => {
      toast.error(error.message);
      onSaved();
    },
  });
  const actions =
    row.status === "PROPOSED"
      ? [
          ...(!row.isAuthor && new Date(row.expiresAt) > new Date() ? ["AUTHORISED"] : []),
          "REJECTED",
        ]
      : row.status === "AUTHORISED"
        ? ["REVOKED"]
        : [];
  return (
    <article className="space-y-2 rounded-xl border bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{row.recipient}</h4>
        <span
          className={`rounded-full px-2 py-1 text-[10px] ${row.effectiveStatus === "AUTHORISED" ? "bg-mint-soft text-mint-deep" : "bg-amber-50 text-amber-800"}`}
        >
          {row.effectiveStatus}
        </span>
      </div>
      <p className="text-xs">{row.purpose}</p>
      <p className="text-[11px] text-muted-foreground">
        Scope: {row.scopeReference} · Authority: {row.agreementReference}
        <br />
        {row.categories.join(" · ")}
        <br />
        Expires {formatDateTime(row.expiresAt)}
      </p>
      {row.decisionReason && <p className="text-xs">Decision: {row.decisionReason}</p>}
      <div className="flex flex-wrap gap-2">
        {actions.map((status) => (
          <Button
            variant="outline"
            size="sm"
            key={status}
            onClick={() => setAction(action === status ? "" : status)}
          >
            {status === "AUTHORISED"
              ? "Authorise scope"
              : status === "REJECTED"
                ? "Reject"
                : "Revoke authority"}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setHistory(!history)}>
          {history ? "Hide history" : "Decision history"}
        </Button>
      </div>
      {row.isAuthor && row.status === "PROPOSED" && (
        <p className="text-[11px] text-muted-foreground">
          A different Platform Admin must authorise your request.
        </p>
      )}
      {action && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <label className="text-xs">
            Decision rationale
            <Textarea
              required
              minLength={10}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <Button
            size="sm"
            type="submit"
            disabled={save.isPending || reason.trim().length < 10}
            loading={save.isPending}
          >
            {save.isPending ? "Saving…" : "Confirm decision"}
          </Button>
        </form>
      )}
      {history && <SharingHistory id={row.id} />}
    </article>
  );
}
function SharingHistory({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["sharing-events", id, page],
    queryFn: () => sharingEvents(id, page),
  });
  return (
    <div className="space-y-2 border-t pt-3">
      {query.isPending && (
        <p role="status" className="text-xs">
          Loading history…
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
      {query.data?.items.map((item) => (
        <div key={item.id} className="border-l-2 border-blue-200 pl-3 text-xs">
          <p>{item.detail?.status ?? item.action}</p>
          {item.detail?.reason && <p>{item.detail.reason}</p>}
          <p className="text-[11px] text-muted-foreground">
            {item.actor?.displayName ?? "System"} · {formatDateTime(item.createdAt)}
          </p>
        </div>
      ))}
      {query.data && query.data.total > 8 && (
        <div className="flex items-center justify-between">
          <Button size="sm" variant="ghost" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-xs">
            {page} / {Math.ceil(query.data.total / 8)}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={page * 8 >= query.data.total}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
