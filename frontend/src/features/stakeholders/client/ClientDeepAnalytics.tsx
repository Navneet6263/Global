import { Link } from "@tanstack/react-router";
import type { ClientAnalyticsDashboard } from "@/lib/api/dashboards";
import { caseStatusLabel, humanize } from "./client-portal-utils";
import { ClientEmpty, ClientPill } from "./ClientPageParts";

const age = (hours: number) => (hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`);

export function ClientDeepAnalytics({
  data,
  view,
}: {
  data: ClientAnalyticsDashboard;
  view: "flow" | "quality";
}) {
  if (view === "flow")
    return (
      <section className="client-register">
        <div className="client-register-title">
          <div>
            <h2>Stage ageing</h2>
            <p>Current active cases and the oldest waiting time at each stage.</p>
          </div>
        </div>
        <div className="client-register-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Current stage</th>
                <th scope="col">Active cases</th>
                <th scope="col">Oldest age</th>
                <th scope="col">Explore</th>
              </tr>
            </thead>
            <tbody>
              {data.stageHealth.map((row) => (
                <tr key={row.status}>
                  <td>
                    <strong>{caseStatusLabel(row.status)}</strong>
                  </td>
                  <td>{row.count}</td>
                  <td>
                    <ClientPill tone={row.oldestAgeHours >= 72 ? "amber" : "blue"}>
                      {age(row.oldestAgeHours)}
                    </ClientPill>
                  </td>
                  <td>
                    <Link
                      to="/client-portal/verifications"
                      search={{ status: row.status }}
                      className="client-text-link"
                    >
                      View cases →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.stageHealth.length && (
          <ClientEmpty title="No active stages">
            Stage ageing appears when cases are in progress.
          </ClientEmpty>
        )}
      </section>
    );

  return (
    <div className="client-quality-stack">
      <section className="client-register">
        <div className="client-register-title">
          <div>
            <h2>Check outcome hotspots</h2>
            <p>Non-clear = discrepancy or unable to verify, divided by returned outcomes.</p>
          </div>
        </div>
        <div className="client-register-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "Check type",
                  "Clear",
                  "Discrepancy",
                  "Unable to verify",
                  "Pending",
                  "Non-clear rate",
                ].map((label) => (
                  <th scope="col" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.checkHealth.map((row) => (
                <tr key={row.type}>
                  <td>
                    <strong>{humanize(row.type)}</strong>
                    <small>{row.total} checks</small>
                  </td>
                  <td>{row.clear}</td>
                  <td>{row.discrepancies}</td>
                  <td>{row.unableToVerify}</td>
                  <td>{row.pending}</td>
                  <td>
                    <ClientPill tone={row.discrepancies + row.unableToVerify ? "amber" : "green"}>
                      {row.returned
                        ? `${Math.round(((row.discrepancies + row.unableToVerify) / row.returned) * 100)}%`
                        : "No outcomes"}
                    </ClientPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.checkHealth.length && (
          <ClientEmpty title="No check outcomes yet">
            Results will appear as checks are returned.
          </ClientEmpty>
        )}
      </section>
      <div className="client-quality-grid">
        <section className="client-register">
          <div className="client-register-title">
            <div>
              <h2>Document quality</h2>
              <p>Current document records, grouped by type.</p>
            </div>
          </div>
          <div className="client-register-scroll">
            <table>
              <thead>
                <tr>
                  {["Type", "Total", "Verified", "Available", "Rejected"].map((label) => (
                    <th scope="col" key={label}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.documentHealth.map((row) => (
                  <tr key={row.type}>
                    <td>
                      <strong>{humanize(row.type)}</strong>
                    </td>
                    <td>{row.total}</td>
                    <td>{row.verified}</td>
                    <td>{row.available}</td>
                    <td>
                      <ClientPill tone={row.rejected ? "red" : "green"}>{row.rejected}</ClientPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.documentHealth.length && (
            <ClientEmpty title="No document data">Uploads will populate this view.</ClientEmpty>
          )}
        </section>
        <section className="client-panel">
          <h2>Quality decisions</h2>
          <p className="client-muted">Recorded QA decisions, not unique candidate counts.</p>
          <dl className="client-decision-list">
            {Object.entries(data.qaDecisions).map(([label, count]) => (
              <div key={label}>
                <dt>{humanize(label)}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
          {!Object.keys(data.qaDecisions).length && (
            <p className="client-note">No QA decisions recorded yet.</p>
          )}
          <Link to="/client-portal/actions" className="client-text-link">
            Review requested corrections →
          </Link>
        </section>
      </div>
    </div>
  );
}
