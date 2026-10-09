import { Link } from "@tanstack/react-router";
import {
  CircleAlert,
  CircleCheck,
  CircleHelp,
  FileText,
  UserRound,
  UsersRound,
} from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import type { ExceptionsDashboard, OperationsDashboard } from "@/lib/api/dashboards";
import { rmInitials, useClientRm } from "./use-client-rm";

export function ClientAttentionPanel({
  data,
  operations,
  loading,
  error,
  onRetry,
  retrying,
}: {
  data?: ExceptionsDashboard;
  operations?: OperationsDashboard;
  loading: boolean;
  error?: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  const results = [
    { label: "Clear", key: "CLEAR", color: "#15803d", icon: CircleCheck },
    { label: "Discrepancy", key: "DISCREPANCY", color: "#b45309", icon: CircleAlert },
    { label: "Unable to verify", key: "UNABLE_TO_VERIFY", color: "#6d28d9", icon: CircleHelp },
  ];
  const rm = useClientRm();
  const person = rm.data?.rm ?? null;
  const total = results.reduce((sum, item) => sum + (operations?.outcomeMix[item.key] ?? 0), 0);
  return (
    <aside className="client-context-panels" aria-label="Client actions and support">
      <section className="client-panel">
        <header className="client-panel-head">
          <h2>
            Your attention needed <small>{data ? `(${data.summary.clientActions})` : ""}</small>
          </h2>
        </header>
        {loading ? (
          <ListSkeleton rows={3} />
        ) : error ? (
          <ErrorState description={error} onRetry={onRetry} retrying={retrying} />
        ) : data ? (
          <div className="client-attention-list">
            <Link to="/client-portal/actions">
              <FileText aria-hidden />
              <span>
                {data.summary.rejectedDocuments ?? data.rejectedDocuments.length} document
                replacements
              </span>
              <small>View requests →</small>
            </Link>
            <Link to="/client-portal/actions">
              <CircleAlert aria-hidden />
              <span>
                {data.clarifications.filter((item) => item.status === "OPEN").length} open detail
                requests
              </span>
              <small>Respond →</small>
            </Link>
            <Link to="/client-portal/verifications" search={{ status: "CONSENT_PENDING" }}>
              <UserRound aria-hidden />
              <span>
                {operations ? (operations.statusMix["CONSENT_PENDING"] ?? 0) : "—"} pending consent
              </span>
              <small>View cases →</small>
            </Link>
          </div>
        ) : null}
      </section>
      <section className="client-panel">
        <h2>Your relationship manager</h2>
        {person ? (
          <>
            <div className="client-contact-row">
              <span className="client-contact-avatar" aria-hidden>
                {rmInitials(person.name)}
              </span>
              <div className="min-w-0">
                <strong>{person.name}</strong>
                <p>
                  <a href={`mailto:${person.email}`}>{person.email}</a>
                  {person.phone ? (
                    <>
                      <br />
                      <a href={`tel:${person.phone}`}>{person.phone}</a>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            <a href={`mailto:${person.email}`} className="client-outline-link">
              Email your RM
            </a>
          </>
        ) : (
          <>
            <div className="client-contact-row">
              <span className="client-contact-avatar">
                <UsersRound aria-hidden />
              </span>
              <div>
                <strong>{rm.isLoading ? "Loading…" : "RM being assigned"}</strong>
                <p>Sapling Global will assign your RM soon. Use support meanwhile.</p>
              </div>
            </div>
            <Link to="/client-portal/support" className="client-outline-link">
              Contact support
            </Link>
          </>
        )}
      </section>
      <section className="client-panel">
        <header className="client-panel-head">
          <h2>
            Check results <small>{operations ? `(${total})` : ""}</small>
          </h2>
          <p>Recorded outcomes</p>
        </header>
        {results.map(({ label, key, color, icon: Icon }) => {
          const count = operations?.outcomeMix[key] ?? 0;
          return (
            <div className="client-result-row" key={key}>
              <span>
                <Icon style={{ color }} aria-hidden />
                {label}
              </span>
              <span className="client-result-track">
                <i
                  style={{ background: color, width: total ? `${(count / total) * 100}%` : "0%" }}
                />
              </span>
              <strong>{operations ? count : "—"}</strong>
            </div>
          );
        })}
        <p className="client-panel-note mt-4">
          {operations
            ? "Check outcomes are not a released final report."
            : "Result totals are currently unavailable."}
        </p>
        <Link to="/client-portal/analytics" className="client-text-link">
          Open detailed insights →
        </Link>
      </section>
    </aside>
  );
}
