import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { RefreshCw, Search } from "lucide-react";
import { getSession } from "@/lib/api/auth";
import { DispatchDialog } from "../dispatch/dispatch-dialog";
import { actionKinds, actionMeta } from "./action-inbox-model";
import { useActionInbox } from "./use-action-inbox";
import { ActionInboxList } from "./action-inbox-list";

export function OperationsActionInbox() {
  const search = useSearch({ from: "/operations/attention" });
  const navigate = useNavigate({ from: "/operations/attention" });
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
  const total = query.data?.summary
    .filter((row) => actionKinds.includes(row.action))
    .reduce((sum, row) => sum + row.cases, 0);
  return (
    <section aria-label="Operations action inbox" className="attn-card">
      <header className="attn-card-head">
        <div>
          <h2>Action required</h2>
          <p>
            {total !== undefined
              ? `${total.toLocaleString("en-IN")} items waiting`
              : "Pending work by case"}{" "}
            · overdue first · refreshes every 30s
          </p>
        </div>
        <div className="attn-inbox-tools">
          <label className="attn-search">
            <Search aria-hidden />
            <input
              aria-label="Search action inbox"
              value={search.q ?? ""}
              onChange={(event) => patch({ q: event.target.value, page: 1 })}
              placeholder="Candidate, case or client"
              maxLength={120}
            />
          </label>
          <button
            type="button"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
            className="attn-icon-button"
            aria-label="Refresh inbox"
            title={query.isFetching ? "Updating…" : "Refresh inbox"}
          >
            <RefreshCw className={query.isFetching ? "animate-spin" : ""} aria-hidden />
          </button>
        </div>
      </header>
      <nav aria-label="Pending work categories" className="attn-tabs">
        {actionKinds.map((kind) => {
          const meta = actionMeta[kind];
          const count = query.data?.summary.find((row) => row.action === kind);
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={action === kind}
              onClick={() => patch({ action: kind, page: 1, q: undefined })}
              className="attn-tab"
              title={meta.detail}
            >
              {meta.label}
              <span className="attn-detail">{meta.detail}</span>
              <span
                className="attn-count"
                aria-label={count ? `${count.cases} cases` : "Count unavailable"}
              >
                {count ? count.cases.toLocaleString("en-IN") : "—"}
              </span>
            </button>
          );
        })}
      </nav>
      <div aria-busy={query.isFetching}>
        {query.isError ? (
          <div role="alert" className="attn-alert">
            Could not update this inbox. {query.error.message}{" "}
            <button type="button" className="ops-link ml-1" onClick={() => void query.refetch()}>
              Retry
            </button>
          </div>
        ) : null}
        {query.isPending ? (
          <p role="status" className="attn-empty">
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
      </div>{" "}
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
