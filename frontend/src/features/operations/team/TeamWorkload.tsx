import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { OPS_CHECK_LABELS } from "../contracts/case";
import type { TeamCapacity } from "../contracts/operations";
import { formatDuration } from "@/lib/formatting";
import {
  LOAD_LABEL,
  filterTeam,
  initials,
  loadState,
  type LoadState,
  type TeamSort,
} from "./team-model";

/** Who is loaded, who has room, and where the open work sits. */
export function TeamWorkload({ data }: { data: TeamCapacity }) {
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("all");
  const [state, setState] = useState<LoadState | "all">("all");
  const [sort, setSort] = useState<TeamSort>("load");
  const branches = useMemo(
    () => [...new Set(data.members.map((member) => member.branch))].sort(),
    [data.members],
  );
  const rows = filterTeam(data.members, { search, branch, state, sort });
  const demandMax = Math.max(1, ...data.demand.map((row) => row.open));

  return (
    <div className="team-grid">
      <section className="team-card" aria-labelledby="team-people-title">
        <header className="team-card-head">
          <div>
            <h2 id="team-people-title">Team members</h2>
            <p>Open checks, due today and overdue per person. Highest load first.</p>
          </div>
        </header>
        <div className="team-toolbar">
          <label className="team-search">
            <Search aria-hidden />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or role"
              aria-label="Search team"
            />
          </label>
          <select
            aria-label="Branch"
            value={branch}
            onChange={(event) => setBranch(event.target.value)}
          >
            <option value="all">All branches</option>
            {branches.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label="Load"
            value={state}
            onChange={(event) => setState(event.target.value as LoadState | "all")}
          >
            <option value="all">Any load</option>
            {(Object.keys(LOAD_LABEL) as LoadState[]).map((key) => (
              <option key={key} value={key}>
                {LOAD_LABEL[key]}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as TeamSort)}
          >
            <option value="load">Sort: highest load</option>
            <option value="overdue">Sort: most overdue</option>
            <option value="name">Sort: name</option>
          </select>
        </div>
        {rows.length ? (
          <div className="team-table-scroll">
            <table className="team-table" aria-label="Team members">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Load</th>
                  <th className="is-num">Open</th>
                  <th className="is-num">Due today</th>
                  <th className="is-num">Overdue</th>
                  <th className="is-num">Avg TAT</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((member) => {
                  const level = loadState(member);
                  return (
                    <tr key={member.id}>
                      <td>
                        <div className="team-person">
                          <span className="team-avatar" aria-hidden>
                            {initials(member.name)}
                          </span>
                          <span className="min-w-0">
                            <strong>{member.name}</strong>
                            <small>
                              {member.role} · {member.branch}
                            </small>
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="team-load">
                          <span className={`team-pill is-${level}`}>{LOAD_LABEL[level]}</span>
                          <span className="team-meter" aria-hidden>
                            <span
                              className={`is-${level}`}
                              style={{ width: `${Math.min(100, member.relativeLoadPercent)}%` }}
                            />
                          </span>
                        </div>
                      </td>
                      <td className="is-num">{member.activeChecks}</td>
                      <td className="is-num">{member.dueToday || "—"}</td>
                      <td className={`is-num ${member.overdue ? "is-bad" : ""}`}>
                        {member.overdue || "—"}
                      </td>
                      <td className="is-num">
                        {member.averageTurnaroundMinutes === null
                          ? "—"
                          : formatDuration(member.averageTurnaroundMinutes)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="team-empty">
            {data.members.length ? "No one matches these filters." : "No team members yet."}
          </p>
        )}
      </section>

      <div className="team-side">
        <section className="team-card" aria-labelledby="team-demand-title">
          <header className="team-card-head">
            <div>
              <h2 id="team-demand-title">Open work by check</h2>
              <p>Where today&apos;s queue is concentrated.</p>
            </div>
          </header>
          {data.demand.length ? (
            <ul className="team-bars">
              {data.demand.map((row) => (
                <li key={row.checkType}>
                  <span>{OPS_CHECK_LABELS[row.checkType]}</span>
                  <strong>{row.open}</strong>
                  <span className="team-meter" aria-hidden>
                    <span style={{ width: `${(row.open / demandMax) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="team-empty">No open checks.</p>
          )}
        </section>
        <section className="team-card" aria-labelledby="team-branch-title">
          <header className="team-card-head">
            <div>
              <h2 id="team-branch-title">Branches</h2>
              <p>People, open checks and share of the work.</p>
            </div>
          </header>
          {data.branches.length ? (
            <ul className="team-bars">
              {data.branches.map((row) => (
                <li key={row.branch}>
                  <span>
                    {row.branch}
                    <small>
                      {row.members} people · {row.openChecks} checks
                    </small>
                  </span>
                  <strong>{Math.round(row.loadPercent)}%</strong>
                  <span className="team-meter" aria-hidden>
                    <span
                      className={
                        row.loadPercent > 90 ? "is-overdue" : row.loadPercent > 75 ? "is-full" : ""
                      }
                      style={{ width: `${Math.min(100, row.loadPercent)}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="team-empty">No branches yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
