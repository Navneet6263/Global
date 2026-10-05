import { useState } from "react";
import type { ClientAnalyticsDashboard } from "@/lib/backend-api/dashboards";
import { ClientEmpty, ClientPager, ClientPill, ClientSearch } from "./ClientPageParts";

export function ClientBranchComparison({ rows }: { rows: ClientAnalyticsDashboard["branches"] }) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("total");
  const [page, setPage] = useState(1);
  const filtered = rows
    .filter((row) => `${row.name} ${row.city ?? ""}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sort === "overdue"
        ? b.overdue - a.overdue
        : sort === "name"
          ? a.name.localeCompare(b.name)
          : b.total - a.total,
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const current = Math.min(page, pages);
  return (
    <section className="client-register">
      <div className="client-register-title">
        <div>
          <h2>Delivery branch comparison</h2>
          <p>
            Only your organisation's cases. Completion includes all cases; overdue includes active
            work only.
          </p>
        </div>
      </div>
      <div className="client-register-toolbar">
        <ClientSearch
          label="Search delivery branches"
          placeholder="Branch or city"
          value={input}
          onChange={setInput}
          onSubmit={() => {
            setSearch(input.trim());
            setPage(1);
          }}
        />
        <select
          aria-label="Sort branches"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
        >
          <option value="total">Most cases</option>
          <option value="overdue">Most overdue</option>
          <option value="name">Branch name</option>
        </select>
        <span className="client-register-meta">{filtered.length} branches</span>
      </div>
      <div className="client-register-scroll">
        <table>
          <thead>
            <tr>
              {[
                "Branch",
                "Total / active",
                "Completed",
                "Overdue",
                "Pending documents",
                "Clarifications",
              ].map((label) => (
                <th scope="col" key={label}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice((current - 1) * 8, current * 8).map((row) => (
              <tr key={row.id ?? "unassigned"}>
                <td>
                  <strong>{row.name}</strong>
                  <small>{row.city ?? "Location not recorded"}</small>
                </td>
                <td>
                  {row.total}
                  <small>
                    {row.active} active · {row.cancelled} cancelled
                  </small>
                </td>
                <td>
                  <strong>{row.completed}</strong>
                  <small>{row.completionPercent}% of all cases</small>
                </td>
                <td>
                  <ClientPill tone={row.overdue ? "red" : "green"}>{row.overdue}</ClientPill>
                </td>
                <td>{row.pendingDocuments}</td>
                <td>{row.clarifications}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filtered.length && (
        <ClientEmpty title="No matching branch data">Try a different branch or city.</ClientEmpty>
      )}
      <ClientPager
        page={current}
        previous={current > 1}
        next={current < pages}
        onPrevious={() => setPage(current - 1)}
        onNext={() => setPage(current + 1)}
        detail="Grouped by assigned operating branch."
      />
    </section>
  );
}
