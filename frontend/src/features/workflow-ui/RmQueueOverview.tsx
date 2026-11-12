import {
  ArrowRight,
  CircleCheck,
  Clock3,
  FolderOpen,
  Siren,
  TriangleAlert,
  UserRoundCheck,
} from "lucide-react";
import { rmBuckets, type CaseQueue, type RmBucket } from "@/lib/backend-api/workflow";
import type { RmQueueSearch } from "./RmWorkQueue";

const STAGE_COLORS: Record<RmBucket, string> = {
  needs_data_entry: "#93c5fd",
  with_data_entry: "#c7d2fe",
  correction: "#fcd34d",
  ready: "#86efac",
  in_verification: "#6ee7b7",
  qc: "#c4b5fd",
  final_approval: "#fdba74",
};

function Kpi({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Clock3;
  label: string;
  value: number | undefined;
  tone: "info" | "action" | "neutral" | "bad" | "good";
}) {
  return (
    <div className={`rmo-kpi is-${tone}`}>
      <Icon aria-hidden />
      <span>
        <small>{label}</small>
        <strong>{value ?? "—"}</strong>
      </span>
    </div>
  );
}

export function RmQueueOverview({
  search,
  summary,
  counts,
  myActions,
  stageTotal,
  onChange,
}: {
  search: RmQueueSearch;
  summary: CaseQueue["summary"] | undefined;
  counts: Record<string, number>;
  myActions: number | undefined;
  stageTotal: number;
  onChange: (patch: Partial<RmQueueSearch>, replace?: boolean) => void;
}) {
  return (
    <>
      <section className="rmo-kpis" aria-label="Your numbers">
        <Kpi icon={FolderOpen} label="Active cases" value={summary?.active} tone="info" />
        <Kpi icon={UserRoundCheck} label="My actions" value={myActions} tone="action" />
        <Kpi icon={Clock3} label="Due today" value={summary?.dueToday} tone="neutral" />
        <Kpi icon={TriangleAlert} label="Overdue" value={summary?.overdue} tone="bad" />
        <Kpi
          icon={CircleCheck}
          label="Completed this week"
          value={summary?.completedThisWeek}
          tone="good"
        />
      </section>

      {summary?.escalated && search.flag !== "escalated" ? (
        <div className="rmo-alert" role="alert">
          <Siren aria-hidden />
          <span>
            <strong>
              {summary.escalated} escalated {summary.escalated === 1 ? "case needs" : "cases need"}{" "}
              you now
            </strong>
            Raised by the client or Sapling management. Escalated cases are high priority.
          </span>
          <button
            type="button"
            onClick={() => onChange({ flag: "escalated", bucket: undefined, page: undefined })}
          >
            View escalations <ArrowRight aria-hidden />
          </button>
        </div>
      ) : null}

      <section className="rmo-card rmo-stages" aria-label="Cases by current stage">
        <header>
          <h2>
            Cases by current stage <small>({stageTotal} total)</small>
          </h2>
          {search.bucket ? (
            <button
              type="button"
              className="rmo-link"
              onClick={() => onChange({ bucket: undefined, page: undefined })}
            >
              Show all active
            </button>
          ) : (
            <span className="rmo-muted">Choose a stage to filter the queue.</span>
          )}
        </header>
        <div className="rmo-stage-bar" aria-hidden>
          {rmBuckets.map((bucket) =>
            counts[bucket.value] ? (
              <span
                key={bucket.value}
                style={{ flexGrow: counts[bucket.value], background: STAGE_COLORS[bucket.value] }}
              />
            ) : null,
          )}
          {!stageTotal ? <span className="is-empty" /> : null}
        </div>
        <div className="rmo-stage-list">
          {rmBuckets.map((bucket) => {
            const pressed = search.bucket === bucket.value;
            return (
              <button
                key={bucket.value}
                type="button"
                aria-pressed={pressed}
                className={pressed ? "is-active" : ""}
                onClick={() =>
                  onChange({
                    bucket: pressed ? undefined : bucket.value,
                    flag: undefined,
                    page: undefined,
                  })
                }
              >
                <span className="rmo-dot" style={{ background: STAGE_COLORS[bucket.value] }} />
                <small>{bucket.label}</small>
                <strong>{counts[bucket.value] ?? "—"}</strong>
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
