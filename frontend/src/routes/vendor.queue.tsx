import { useDeferredValue, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  FileText,
  Hand,
  IndianRupee,
  ListTodo,
  MapPin,
  RotateCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WorkspaceError, WorkspaceLoading } from "@/features/delivery/WorkspaceStates";
import { readable, rupees } from "@/features/vendor-checks/vendor-job-format";
import { vendorQueueApi, type QueueItem } from "@/lib/backend-api/vendor-checks";
import { formatDateTime } from "@/lib/formatting";

export const Route = createFileRoute("/vendor/queue")({
  head: () => ({ meta: [{ title: "Open queue — Sapling Global" }] }),
  component: VendorQueuePage,
});

const CHECK_TYPES = ["ADDRESS", "COURT_RECORD", "CRIMINAL", "EMPLOYMENT", "EDUCATION", "DRUG_TEST"];

/**
 * The open vendor queue: every approved vendor sees each check (type, payment, city,
 * due date, documents to collect) and the first to pick it gets it.
 */
function VendorQueuePage() {
  const [city, setCity] = useState("");
  const [checkType, setCheckType] = useState("");
  const deferredCity = useDeferredValue(city.trim());
  const queue = useQuery({
    queryKey: ["vendor-queue", deferredCity, checkType],
    queryFn: () =>
      vendorQueueApi.list({
        ...(deferredCity ? { city: deferredCity } : {}),
        ...(checkType ? { checkType } : {}),
      }),
    // Other vendors pick checks too: keep the list fresh.
    refetchInterval: 30_000,
  });
  return (
    <div className="grid gap-4">
      <header className="client-heading">
        <div>
          <h1>Open queue</h1>
          <p>
            Checks any approved vendor can take. Pick one to see the full details and start work;
            the first vendor to pick it gets it.
          </p>
        </div>
      </header>

      <section
        aria-label="Queue summary and filters"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
      >
        <div className="flex items-center gap-3 pr-2">
          <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700">
            <ListTodo className="size-5" aria-hidden />
          </span>
          <div className="leading-tight">
            <p className="text-[12.5px] text-slate-500">Waiting to be picked</p>
            <p className="text-[20px] font-semibold text-slate-900">
              {queue.data ? queue.data.summary.count : "—"}
              {queue.data?.summary.value ? (
                <span className="ml-2 text-[13px] font-medium text-slate-500">
                  worth {rupees(queue.data.summary.value)}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <label className="ml-auto grid gap-1 text-[12.5px] text-slate-600">
          City
          <span className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
            <Search className="size-4 text-slate-400" aria-hidden />
            <input
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="e.g. Lucknow"
              aria-label="Filter by city"
              className="w-40 bg-transparent text-[13.5px] outline-none"
            />
          </span>
        </label>
        <label className="grid gap-1 text-[12.5px] text-slate-600">
          Check type
          <select
            value={checkType}
            onChange={(event) => setCheckType(event.target.value)}
            aria-label="Filter by check type"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-[13.5px]"
          >
            <option value="">All checks</option>
            {CHECK_TYPES.map((type) => (
              <option key={type} value={type}>
                {readable(type)}
              </option>
            ))}
          </select>
        </label>
      </section>

      {queue.isPending ? (
        <WorkspaceLoading label="Loading the open queue" />
      ) : queue.isError ? (
        <WorkspaceError message={queue.error.message} onRetry={() => void queue.refetch()} />
      ) : queue.data.items.length ? (
        <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3" aria-label="Open checks">
          {queue.data.items.map((item) => (
            <QueueCard key={item.id} item={item} />
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-[13.5px] text-slate-500">
          No check is waiting right now. New checks appear here and in your notifications.
        </p>
      )}
    </div>
  );
}

function QueueCard({ item }: { item: QueueItem }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const pick = useMutation({
    mutationFn: () => vendorQueueApi.pick(item.id, item.version),
    onSuccess: async () => {
      toast.success("The check is yours", {
        description: "It is now in My checks with the full details.",
      });
      await queryClient.invalidateQueries({ queryKey: ["vendor-queue"] });
      await queryClient.invalidateQueries({ queryKey: ["vendor-checks"] });
      await navigate({ to: "/vendor/checks" });
    },
    onError: async (error: Error) => {
      toast.error("Not picked", { description: error.message });
      await queryClient.invalidateQueries({ queryKey: ["vendor-queue"] });
    },
  });
  const location = [item.city, item.pincode].filter(Boolean).join(" · ");
  return (
    <li className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-slate-900">{readable(item.checkType)}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-slate-600">
            <MapPin className="size-3.5 shrink-0 text-slate-400" aria-hidden />
            {location || "City not given"}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-xl bg-emerald-50 px-3 py-1.5 text-[16px] font-semibold text-emerald-700">
          <IndianRupee className="size-4" aria-hidden />
          {item.price !== null
            ? item.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })
            : "—"}
        </span>
      </div>
      <dl className="grid gap-1.5 text-[12.5px] text-slate-600">
        <div className="flex items-center gap-1.5">
          <CalendarClock className="size-3.5 text-slate-400" aria-hidden />
          <dt className="sr-only">Due</dt>
          <dd>{item.dueAt ? `Due ${formatDateTime(item.dueAt)}` : "No due date"}</dd>
        </div>
        <div className="flex items-start gap-1.5">
          <FileText className="mt-0.5 size-3.5 text-slate-400" aria-hidden />
          <dt className="sr-only">Documents</dt>
          <dd>
            {item.documents.length
              ? `Documents shared: ${item.documents.map(readable).join(", ")}`
              : "No documents shared"}
          </dd>
        </div>
        {item.returnedTimes ? (
          <div className="flex items-center gap-1.5 text-amber-700">
            <RotateCcw className="size-3.5" aria-hidden />
            <dd>
              Returned by a vendor {item.returnedTimes} time{item.returnedTimes === 1 ? "" : "s"}
            </dd>
          </div>
        ) : null}
      </dl>
      {item.instructions ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] text-slate-700">
          {item.instructions}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <small className="text-[12px] text-slate-400">Posted {formatDateTime(item.postedAt)}</small>
        <Button
          size="sm"
          loading={pick.isPending}
          onClick={() => pick.mutate()}
          aria-label={`Pick ${readable(item.checkType)} check${item.city ? ` in ${item.city}` : ""}`}
        >
          <Hand aria-hidden /> Pick this check
        </Button>
      </div>
    </li>
  );
}
