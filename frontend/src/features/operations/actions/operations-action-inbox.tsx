import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronRight, RefreshCw, Search } from "lucide-react";
import { getSession } from "@/lib/api/auth";
import { DispatchDialog } from "../dispatch/dispatch-dialog";
import { actionKinds, actionMeta } from "./action-inbox-model";
import { useActionInbox } from "./use-action-inbox";
import { ActionInboxList } from "./action-inbox-list";

export function OperationsActionInbox() {
  const search = useSearch({ from: "/operations/" });
  const navigate = useNavigate({ from: "/operations/" });
  const action = search.action ?? "documents";
  const query = useActionInbox(search);
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const [dispatchId, setDispatchId] = useState<string>();
  const canStart =
    session.data?.permissions.includes("*") ||
    Boolean(
      session.data?.permissions.includes("case:transition") &&
      session.data?.permissions.includes("task:write"),
    );
  const patch = (next: Partial<typeof search>) =>
    void navigate({
      search: (previous) => ({ ...previous, ...next }),
      replace: true,
      resetScroll: false,
    });
  return (
    <section
      aria-label="Operations action inbox"
      className="overflow-hidden rounded-2xl border border-border bg-white"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Action required</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Pending work by case · categories may overlap
          </p>
        </div>
        <button
          type="button"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-xs font-medium disabled:opacity-60"
        >
          <RefreshCw className={`size-3.5 ${query.isFetching ? "animate-spin" : ""}`} aria-hidden />
          {query.isFetching ? "Updating…" : "Refresh inbox"}
        </button>
      </header>
      <div className="grid xl:grid-cols-[16rem_minmax(0,1fr)]">
        <nav
          aria-label="Pending work categories"
          className="grid grid-cols-1 content-start divide-y divide-border/60 border-b border-border sm:grid-cols-2 xl:grid-cols-1 xl:border-b-0 xl:border-r"
        >
          {actionKinds.map((kind) => {
            const meta = actionMeta[kind];
            const Icon = meta.icon;
            const count = query.data?.summary.find((row) => row.action === kind);
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={action === kind}
                onClick={() => patch({ action: kind, page: 1, q: undefined })}
                className={`flex min-h-14 min-w-0 items-center gap-2.5 border-l-2 px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary ${action === kind ? `${meta.colour} border-l-current` : "border-l-transparent bg-white hover:bg-secondary/50"}`}
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-lg ${meta.colour}`}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 text-xs font-medium">{meta.label}</span>
                <span
                  className={`num inline-flex min-w-7 shrink-0 justify-center rounded-md px-1.5 py-1 text-xs font-semibold ${meta.colour}`}
                  aria-label={count ? `${count.cases} cases` : "Count unavailable"}
                >
                  {count ? count.cases.toLocaleString("en-IN") : "—"}
                </span>
                <ChevronRight className="size-3 shrink-0 opacity-50" aria-hidden />
              </button>
            );
          })}
        </nav>
        <div className="min-w-0" aria-busy={query.isFetching}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">{actionMeta[action].label}</h3>
              <p className="mt-1 text-xs text-muted-foreground">Overdue first · auto-refresh 30s</p>
            </div>
            <label className="flex min-h-10 w-full items-center gap-2 rounded-full bg-secondary/60 px-4 sm:w-72">
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                aria-label="Search action inbox"
                value={search.q ?? ""}
                onChange={(event) => patch({ q: event.target.value, page: 1 })}
                placeholder="Candidate, case or client"
                maxLength={120}
                className="min-w-0 flex-1 bg-transparent py-2 text-xs outline-none"
              />
            </label>
          </div>
          {query.isError ? (
            <div role="alert" className="m-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">
              Could not update this inbox. {query.error.message}{" "}
              <button type="button" className="ml-2 underline" onClick={() => void query.refetch()}>
                Retry
              </button>
            </div>
          ) : null}
          {query.isPending ? (
            <p role="status" className="px-5 py-10 text-center text-sm text-muted-foreground">
              Finding pending work…
            </p>
          ) : null}
          {query.data && query.data.action === action ? (
            <ActionInboxList
              data={query.data}
              action={action}
              canStart={canStart}
              onStart={setDispatchId}
              onPage={(page) => patch({ page })}
            />
          ) : null}
        </div>
      </div>
      {dispatchId ? (
        <DispatchDialog
          caseIds={[dispatchId]}
          onClose={() => setDispatchId(undefined)}
          onOpenCase={(caseId) => {
            void navigate({
              to: "/cases/$caseId",
              params: { caseId },
              search: { tab: "checks", inbox: "start" },
            });
          }}
        />
      ) : null}
    </section>
  );
}
