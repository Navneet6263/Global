import { useState } from "react";
import { Card, CardHeader, Meter, Row, Select, Table, Td, Th } from "@/kit";
import type { ClientAnalyticsDashboard } from "@/lib/backend-api/dashboards";
import { ClientEmpty, ClientPager, ClientPill, ClientSearch } from "./ClientPageParts";

const COLUMNS = [
  "Branch",
  "Total / active",
  "Completed",
  "Overdue",
  "Pending documents",
  "Clarifications",
];

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
    <Card className="min-w-0">
      <CardHeader
        title="Delivery branch comparison"
        description="Only your organisation's cases. Completion includes all cases; overdue includes active work only."
      />
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
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
        <Select
          aria-label="Sort branches"
          value={sort}
          className="w-auto min-w-[160px]"
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
        >
          <option value="total">Most cases</option>
          <option value="overdue">Most overdue</option>
          <option value="name">Branch name</option>
        </Select>
        <span className="ml-auto font-mono text-xs text-dim">{filtered.length} branches</span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <thead>
            <tr>
              {COLUMNS.map((label) => (
                <Th key={label}>{label}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice((current - 1) * 8, current * 8).map((row) => (
              <Row key={row.id ?? "unassigned"}>
                <Td>
                  <strong className="block font-semibold text-ink">{row.name}</strong>
                  <small className="block text-xs text-dim">
                    {row.city ?? "Location not recorded"}
                  </small>
                </Td>
                <Td>
                  <span className="block font-mono text-ink tabular-nums">{row.total}</span>
                  <small className="block text-xs whitespace-nowrap text-dim">
                    {row.active} active · {row.cancelled} cancelled
                  </small>
                </Td>
                <Td>
                  <strong className="block font-mono font-semibold text-ink tabular-nums">
                    {row.completed}
                  </strong>
                  <div className="my-1 w-24">
                    <Meter
                      value={row.completionPercent}
                      tone="good"
                      label={`${row.name} completion`}
                    />
                  </div>
                  <small className="block text-xs whitespace-nowrap text-dim">
                    {row.completionPercent}% of all cases
                  </small>
                </Td>
                <Td>
                  <ClientPill tone={row.overdue ? "red" : "green"}>{row.overdue}</ClientPill>
                </Td>
                <Td mono>{row.pendingDocuments}</Td>
                <Td mono>{row.clarifications}</Td>
              </Row>
            ))}
          </tbody>
        </Table>
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
    </Card>
  );
}
