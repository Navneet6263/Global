import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExceptionsDashboard } from "@/lib/api/dashboards";
import { formatDate, relativeTime } from "./client-portal-utils";
import { ClientEmpty, ClientPager, ClientPill, ClientSearch } from "./ClientPageParts";
import { clientActionItems, filterClientActions } from "./client-action-model";

const kinds = [
  { value: "", label: "All items", tone: "blue" },
  { value: "response", label: "Your response", tone: "amber" },
  { value: "documents", label: "Documents", tone: "red" },
  { value: "review", label: "Under review", tone: "blue" },
  { value: "overdue", label: "SLA attention", tone: "red" },
];
export function ClientActionCenter({
  data,
  onOpen,
}: {
  data: ExceptionsDashboard;
  onOpen: (caseId: string) => void;
}) {
  const [kind, setKind] = useState("");
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const items = clientActionItems(data);
  const filtered = filterClientActions(items, kind, search);
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const current = Math.min(page, pages);
  return (
    <section className="client-register" aria-label="Action centre">
      <div className="client-register-title">
        <div>
          <h2>Action centre</h2>
          <p>What needs your response and what the delivery team is reviewing.</p>
        </div>
        <span className="client-register-meta">Updated {relativeTime(data.generatedAt)}</span>
      </div>
      <div className="client-register-toolbar">
        <div className="client-segments" role="group" aria-label="Action type">
          {kinds.map((entry) => (
            <button
              key={entry.label}
              aria-pressed={kind === entry.value}
              onClick={() => {
                setKind(entry.value);
                setPage(1);
              }}
            >
              {entry.label}{" "}
              <span>
                {entry.value
                  ? items.filter((item) => item.kind === entry.value).length
                  : items.length}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="client-register-toolbar">
        <ClientSearch
          label="Search action items"
          placeholder="Candidate, case or request"
          value={input}
          onChange={setInput}
          onSubmit={() => {
            setSearch(input);
            setPage(1);
          }}
        />
        {(search || kind) && (
          <Button
            variant="ghost"
            onClick={() => {
              setInput("");
              setSearch("");
              setKind("");
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
        <span className="client-register-meta">
          {filtered.length} matching items in this snapshot
        </span>
      </div>
      <div className="client-action-list">
        {filtered.slice((current - 1) * 8, current * 8).map((item) => (
          <article key={item.id}>
            <div>
              <ClientPill tone={kinds.find((entry) => entry.value === item.kind)?.tone}>
                {kinds.find((entry) => entry.value === item.kind)?.label}
              </ClientPill>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <small>
                <strong>{item.candidate}</strong> · {item.caseNumber}
                {item.dueAt ? ` · Due ${formatDate(item.dueAt)}` : ""}
              </small>
            </div>
            <Button variant="outline" size="sm" onClick={() => onOpen(item.caseId)}>
              {["response", "documents"].includes(item.kind) ? "Review & respond" : "View case"}
              <ArrowRight aria-hidden />
            </Button>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <ClientEmpty title="No matching action items">
          {search || kind
            ? "Change the filters to see other requests."
            : "New requests will appear here when your response is needed."}
        </ClientEmpty>
      )}
      <ClientPager
        page={current}
        previous={current > 1}
        next={current < pages}
        onPrevious={() => setPage(current - 1)}
        onNext={() => setPage(current + 1)}
        detail="Latest exception snapshot. A case may have more than one action item."
      />
    </section>
  );
}
