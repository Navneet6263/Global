import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlarmClock,
  CheckCircle2,
  Info,
  Search,
  ShieldAlert,
  Sparkles,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OpsAssignableItem, OpsTeamMember } from "@/features/operations/contracts/operations";
import { useAssignChecks, useOpsAssignments } from "@/features/operations/hooks/use-operations";
import { formatDuration } from "@/lib/formatting";

const PAGE_SIZE = 10;
const MAX_SELECTION = 50;

const FILTERS = [
  { id: "all", label: "All" },
  { id: "overdue", label: "Overdue" },
  { id: "approaching", label: "At risk" },
  { id: "priority", label: "High priority" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

const SLA_PILL = {
  healthy: { label: "On track", tone: "is-good" },
  approaching: { label: "At risk", tone: "is-warn" },
  overdue: { label: "Overdue", tone: "is-bad" },
} as const;

/** "EMPLOYMENT" → "Employment"; labels already in sentence case stay as they are. */
const checkName = (label: string) =>
  label === label.toUpperCase()
    ? label
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/^\w/, (letter) => letter.toUpperCase())
    : label;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/** Lower is better: overdue work weighs most, then work due today, then open checks. */
const loadScore = (member: OpsTeamMember) =>
  member.overdue * 1_000 + member.dueToday * 50 + member.activeChecks;

/**
 * Operations' override for check allocation. Normally a Team Leader assigns routed
 * checks from the Team queue; this page is for when a team has no TL, the TL is away,
 * or work is stuck. Same API and audit as before.
 */
export function OverrideAllocation() {
  const { data, isPending, isError, error, refetch } = useOpsAssignments();
  const assign = useAssignChecks();
  const [selected, setSelected] = useState<string[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [checkType, setCheckType] = useState("");
  const [page, setPage] = useState(1);

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const members = useMemo(
    () => [...(data?.members ?? [])].sort((a, b) => loadScore(a) - loadScore(b)),
    [data?.members],
  );
  const bestFitId = members[0]?.id ?? null;

  useEffect(() => {
    const available = new Set(items.map((item) => item.id));
    setSelected((current) => current.filter((id) => available.has(id)));
  }, [items]);
  useEffect(() => setPage(1), [query, filter, checkType]);

  const checkTypes = useMemo(
    () => [...new Map(items.map((item) => [item.checkType, item.checkLabel])).entries()],
    [items],
  );
  const text = query.trim().toLowerCase();
  const filtered = items.filter(
    (item) =>
      (filter === "all" ||
        (filter === "priority" ? item.priority !== "standard" : item.slaState === filter)) &&
      (!checkType || item.checkType === checkType) &&
      (!text ||
        [item.candidateName, item.caseNumber, item.clientName, item.checkLabel, item.branch]
          .join(" ")
          .toLowerCase()
          .includes(text)),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selectedSet = new Set(selected);
  const allOnPage = visible.length > 0 && visible.every((item) => selectedSet.has(item.id));
  const member = members.find((entry) => entry.id === memberId) ?? null;

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < MAX_SELECTION
          ? [...current, id]
          : current,
    );
  const togglePage = () =>
    setSelected((current) => {
      if (allOnPage) return current.filter((id) => !visible.some((item) => item.id === id));
      const next = [...current];
      for (const item of visible)
        if (!next.includes(item.id) && next.length < MAX_SELECTION) next.push(item.id);
      return next;
    });

  const submit = () => {
    if (!member || !selected.length) return;
    assign.mutate(
      { itemIds: selected, memberId: member.id, note: note.trim() || undefined },
      {
        onSuccess: () => {
          setSelected([]);
          setMemberId(null);
          setNote("");
        },
      },
    );
  };

  const overdue = items.filter((item) => item.slaState === "overdue").length;
  const atRisk = items.filter((item) => item.slaState === "approaching").length;
  const withRoom = members.filter((entry) => entry.relativeLoadPercent < 80).length;

  return (
    <div className="rmo">
      <aside className="oa-banner" aria-label="When to use this page">
        <Info aria-hidden />
        <div>
          <strong>Normally the Team Leader assigns checks from the Team queue.</strong>
          <span>
            Use this when a team has no TL, the TL is away, or work is stuck. Teams and TLs are set
            in{" "}
            <Link to="/operations/departments" className="rmo-link">
              Departments & teams
            </Link>
            .
          </span>
        </div>
      </aside>

      <section className="rmo-kpis oa-kpis" aria-label="Allocation summary">
        <div className="rmo-kpi is-info">
          <UserCheck aria-hidden />
          <div>
            <small>Waiting for a verifier</small>
            <strong>{data ? items.length : "—"}</strong>
          </div>
        </div>
        <div className="rmo-kpi is-bad">
          <AlarmClock aria-hidden />
          <div>
            <small>Overdue</small>
            <strong>{data ? overdue : "—"}</strong>
          </div>
        </div>
        <div className="rmo-kpi is-action">
          <ShieldAlert aria-hidden />
          <div>
            <small>At risk</small>
            <strong>{data ? atRisk : "—"}</strong>
          </div>
        </div>
        <div className="rmo-kpi is-good">
          <UsersRound aria-hidden />
          <div>
            <small>Verifiers with room</small>
            <strong>{data ? `${withRoom}/${members.length}` : "—"}</strong>
          </div>
        </div>
      </section>

      {isError ? (
        <div className="rmo-card rmo-empty">
          <strong>Could not load the checks</strong>
          <span>{error.message}</span>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : null}

      <div className="oa-grid">
        <section className="rmo-card rmo-queue" aria-label="Checks waiting for a verifier">
          <header className="rmo-queue-head">
            <div>
              <h2>
                <span className="oa-step">1</span> Choose checks
              </h2>
              <p>
                {selected.length} selected · up to {MAX_SELECTION} at once
              </p>
            </div>
            <div className="rmo-queue-tools vjb-tools">
              <label className="rmo-search">
                <Search aria-hidden />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Candidate, case, client or check"
                  aria-label="Search checks"
                />
              </label>
              <select
                value={checkType}
                onChange={(event) => setCheckType(event.target.value)}
                aria-label="Check type"
              >
                <option value="">All checks</option>
                {checkTypes.map(([value, label]) => (
                  <option key={value} value={value}>
                    {checkName(label)}
                  </option>
                ))}
              </select>
            </div>
          </header>
          <div className="rmo-tabs oa-tabs" role="group" aria-label="Quick filter">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={filter === item.id ? "is-active" : ""}
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {isPending ? (
            <div className="rmo-empty">Loading…</div>
          ) : !filtered.length ? (
            <div className="rmo-empty">
              <strong>{items.length ? "No checks match" : "Nothing waiting"}</strong>
              <span>
                {items.length
                  ? "Try another filter or search."
                  : "Every routed check already has a verifier."}
              </span>
            </div>
          ) : (
            <div className="rmo-table-scroll">
              <table className="rmo-table">
                <thead>
                  <tr>
                    <th className="oa-check">
                      <input
                        type="checkbox"
                        checked={allOnPage}
                        onChange={togglePage}
                        aria-label="Select all checks on this page"
                      />
                    </th>
                    <th>Case</th>
                    <th>Check</th>
                    <th>Client</th>
                    <th>Branch</th>
                    <th>SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => (
                    <CheckRow
                      key={item.id}
                      item={item}
                      checked={selectedSet.has(item.id)}
                      disabled={
                        assign.isPending ||
                        (!selectedSet.has(item.id) && selected.length >= MAX_SELECTION)
                      }
                      onToggle={() => toggle(item.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filtered.length > PAGE_SIZE ? (
            <footer className="rmo-pager">
              <span>
                Page {page} of {pages} · {filtered.length} checks
              </span>
              <div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= pages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </footer>
          ) : null}
        </section>

        <div className="oa-side">
          <section className="rmo-card oa-card" aria-label="Choose a verifier">
            <h2>
              <span className="oa-step">2</span> Choose a verifier
            </h2>
            <p className="rmo-muted">Sorted by who has the most room right now.</p>
            {isPending ? (
              <p className="rmo-muted">Loading…</p>
            ) : !members.length ? (
              <p className="rmo-muted">No active verifiers yet.</p>
            ) : (
              <ul className="oa-members">
                {members.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      aria-pressed={memberId === entry.id}
                      onClick={() => setMemberId(entry.id)}
                    >
                      <span className="oa-avatar">{initials(entry.name)}</span>
                      <span className="oa-member">
                        <strong>
                          {entry.name}
                          {entry.id === bestFitId ? (
                            <em>
                              <Sparkles aria-hidden /> Best fit
                            </em>
                          ) : null}
                        </strong>
                        <small>
                          {entry.activeChecks} open · {entry.dueToday} due today · {entry.overdue}{" "}
                          overdue
                          {entry.averageTurnaroundMinutes !== null
                            ? ` · avg ${formatDuration(entry.averageTurnaroundMinutes)}`
                            : ""}
                        </small>
                        <span className="oa-meter" aria-hidden>
                          <span
                            className={
                              entry.overdue
                                ? "is-bad"
                                : entry.relativeLoadPercent >= 80
                                  ? "is-warn"
                                  : ""
                            }
                            style={{ width: `${Math.min(100, entry.relativeLoadPercent)}%` }}
                          />
                        </span>
                      </span>
                      {memberId === entry.id ? (
                        <CheckCircle2 className="oa-picked" aria-hidden />
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rmo-card oa-card" aria-label="Confirm allocation">
            <h2>
              <span className="oa-step">3</span> Confirm
            </h2>
            <dl className="oa-summary">
              <div>
                <dt>Checks</dt>
                <dd>{selected.length || "—"}</dd>
              </div>
              <div>
                <dt>Verifier</dt>
                <dd>{member?.name ?? "—"}</dd>
              </div>
            </dl>
            <label className="ops-field">
              <span>Note for the verifier (optional)</span>
              <textarea
                rows={3}
                maxLength={500}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Source, priority or anything they should know"
                aria-label="Note for the verifier"
              />
            </label>
            <Button
              className="w-full"
              disabled={!member || !selected.length}
              loading={assign.isPending}
              onClick={submit}
            >
              {member && selected.length
                ? `Assign ${selected.length} ${selected.length === 1 ? "check" : "checks"} to ${member.name}`
                : "Pick checks and a verifier"}
            </Button>
            <p className="oa-foot">
              All selected checks are assigned together or none are. Recorded in the audit log with
              your name.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function CheckRow({
  item,
  checked,
  disabled,
  onToggle,
}: {
  item: OpsAssignableItem;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const sla = SLA_PILL[item.slaState];
  return (
    <tr className={checked ? "is-focused" : undefined}>
      <td className="oa-check">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
          aria-label={`Select ${item.checkLabel} for ${item.candidateName}`}
        />
      </td>
      <td>
        <strong className="block text-[13px] text-slate-900">{item.candidateName}</strong>
        <span className="rmo-muted">
          {item.caseNumber}
          {item.priority !== "standard" ? ` · ${item.priority} priority` : ""}
        </span>
      </td>
      <td>{checkName(item.checkLabel)}</td>
      <td>{item.clientName}</td>
      <td>{item.branch}</td>
      <td className="whitespace-nowrap">
        <span className={`rmo-pill ${sla.tone}`}>{sla.label}</span>
        <span className="rmo-muted block">
          {item.slaMinutesRemaining <= 0
            ? `${formatDuration(-item.slaMinutesRemaining)} late`
            : `${formatDuration(item.slaMinutesRemaining)} left`}
        </span>
      </td>
    </tr>
  );
}
