import { ArrowRight, CircleCheck, Clock3, FileText, Siren } from "lucide-react";
import type { CaseQueue, QueueCase } from "@/lib/backend-api/workflow";
import { OpsCaseContext } from "@/features/operations/workspace/OpsCaseContext";
import { sinceLabel } from "./flow-model";
import type { RmQueueSearch } from "./RmWorkQueue";

function FollowUp({
  icon: Icon,
  text,
  action,
  onClick,
}: {
  icon: typeof Clock3;
  text: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <li>
      <Icon aria-hidden />
      <span>{text}</span>
      <button type="button" className="rmo-link" onClick={onClick}>
        {action} <ArrowRight aria-hidden />
      </button>
    </li>
  );
}

export function RmQueueRail({
  search,
  summary,
  counts,
  handover,
  onChange,
}: {
  search: RmQueueSearch;
  summary: CaseQueue["summary"] | undefined;
  counts: Record<string, number>;
  handover: QueueCase | undefined;
  onChange: (patch: Partial<RmQueueSearch>, replace?: boolean) => void;
}) {
  return (
    <aside className="rmo-rail" aria-label="Clients and follow-ups">
      {search.caseId ? (
        <OpsCaseContext
          caseId={search.caseId}
          canManage={false}
          showFullCaseLink={false}
          onClose={() => onChange({ caseId: undefined }, true)}
          onChangeRm={() => undefined}
          onEscalate={() => undefined}
        />
      ) : (
        <>
          <section className="rmo-card" aria-labelledby="rmo-pulse">
            <header className="rmo-rail-head">
              <h2 id="rmo-pulse">Client pulse</h2>
              <span className="rmo-muted">
                {summary ? `${summary.clients.length} with active cases` : ""}
              </span>
            </header>
            {summary?.clients.length ? (
              <table className="rmo-pulse" aria-label="Client pulse">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Active</th>
                    <th>Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.clients.map((client) => (
                    <tr key={client.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => onChange({ client: client.id, page: undefined })}
                        >
                          {client.name}
                        </button>
                      </td>
                      <td>
                        <span className="rmo-dot is-good" /> {client.active}
                      </td>
                      <td className={client.overdue ? "is-bad" : "rmo-muted"}>
                        <span className={`rmo-dot ${client.overdue ? "is-bad" : ""}`} />{" "}
                        {client.overdue}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="rmo-rail-empty">
                {summary ? "No active cases for your clients yet." : "Loading…"}
              </p>
            )}
          </section>

          <section className="rmo-card" aria-labelledby="rmo-follow">
            <header className="rmo-rail-head">
              <h2 id="rmo-follow">Follow-ups</h2>
            </header>
            <ul className="rmo-follow">
              <FollowUp
                icon={Siren}
                text={`${summary?.escalated ?? 0} escalated`}
                action="View"
                onClick={() => onChange({ flag: "escalated", bucket: undefined, page: undefined })}
              />
              <FollowUp
                icon={FileText}
                text={`${counts["correction"] ?? 0} waiting on a correction`}
                action="Open"
                onClick={() => onChange({ bucket: "correction", flag: undefined, page: undefined })}
              />
              <FollowUp
                icon={Clock3}
                text={`${counts["qc"] ?? 0} in QC review`}
                action="View"
                onClick={() => onChange({ bucket: "qc", flag: undefined, page: undefined })}
              />
              <FollowUp
                icon={CircleCheck}
                text={`${counts["final_approval"] ?? 0} waiting for your decision`}
                action="Review"
                onClick={() =>
                  onChange({ bucket: "final_approval", flag: undefined, page: undefined })
                }
              />
            </ul>
          </section>

          {handover ? (
            <section className="rmo-card rmo-handover" aria-labelledby="rmo-handover">
              <header className="rmo-rail-head">
                <h2 id="rmo-handover">Latest handover</h2>
              </header>
              <div>
                <FileText aria-hidden />
                <span>
                  <strong>
                    {handover.caseNumber} · {handover.candidateName}
                  </strong>
                  <small>
                    {handover.client.name} · received {sinceLabel(handover.createdAt)} ago
                  </small>
                  <button
                    type="button"
                    className="rmo-link"
                    onClick={() => onChange({ caseId: handover.id }, true)}
                  >
                    Open case <ArrowRight aria-hidden />
                  </button>
                </span>
              </div>
            </section>
          ) : null}
        </>
      )}
    </aside>
  );
}
