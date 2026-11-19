import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Card, CardHeader, Meter, Row, Table, Td, Th } from "@/kit";
import type { ClientAnalyticsDashboard } from "@/lib/api/dashboards";
import { caseStatusLabel, humanize } from "./client-portal-utils";
import { ClientEmpty, ClientPill } from "./ClientPageParts";

const age = (hours: number) => (hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`);
const LINK = "text-xs font-semibold whitespace-nowrap text-brand hover:underline";

function Name({ title, detail }: { title: ReactNode; detail?: ReactNode }) {
  return (
    <>
      <strong className="block font-semibold text-ink">{title}</strong>
      {detail ? <small className="block text-xs text-dim">{detail}</small> : null}
    </>
  );
}

function Head({ labels }: { labels: string[] }) {
  return (
    <thead>
      <tr>
        {labels.map((label) => (
          <Th key={label}>{label}</Th>
        ))}
      </tr>
    </thead>
  );
}

export function ClientDeepAnalytics({
  data,
  view,
}: {
  data: ClientAnalyticsDashboard;
  view: "flow" | "quality";
}) {
  if (view === "flow") {
    const most = Math.max(1, ...data.stageHealth.map((row) => row.count));
    return (
      <Card className="min-w-0">
        <CardHeader
          title="Stage ageing"
          description="Current active cases and the oldest waiting time at each stage."
        />
        <div className="overflow-x-auto">
          <Table>
            <Head labels={["Current stage", "Active cases", "Oldest age", "Explore"]} />
            <tbody>
              {data.stageHealth.map((row) => (
                <Row key={row.status}>
                  <Td>
                    <Name title={caseStatusLabel(row.status)} />
                  </Td>
                  <Td>
                    <div className="flex min-w-[140px] items-center gap-3">
                      <span className="w-8 font-mono text-ink tabular-nums">{row.count}</span>
                      <div className="w-24">
                        <Meter
                          value={row.count}
                          max={most}
                          label={`${caseStatusLabel(row.status)} active cases`}
                        />
                      </div>
                    </div>
                  </Td>
                  <Td>
                    <ClientPill tone={row.oldestAgeHours >= 72 ? "amber" : "blue"}>
                      {age(row.oldestAgeHours)}
                    </ClientPill>
                  </Td>
                  <Td>
                    <Link
                      to="/client-portal/verifications"
                      search={{ status: row.status }}
                      className={LINK}
                    >
                      View cases →
                    </Link>
                  </Td>
                </Row>
              ))}
            </tbody>
          </Table>
        </div>
        {!data.stageHealth.length && (
          <ClientEmpty title="No active stages">
            Stage ageing appears when cases are in progress.
          </ClientEmpty>
        )}
      </Card>
    );
  }

  const decisions = Object.entries(data.qaDecisions);
  const decisionTotal = decisions.reduce((sum, [, count]) => sum + count, 0);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="min-w-0">
        <CardHeader
          title="Check outcome hotspots"
          description="Non-clear = discrepancy or unable to verify, divided by returned outcomes."
        />
        <div className="overflow-x-auto">
          <Table>
            <Head
              labels={[
                "Check type",
                "Clear",
                "Discrepancy",
                "Unable to verify",
                "Pending",
                "Non-clear rate",
              ]}
            />
            <tbody>
              {data.checkHealth.map((row) => (
                <Row key={row.type}>
                  <Td>
                    <Name title={humanize(row.type)} detail={`${row.total} checks`} />
                  </Td>
                  <Td mono>{row.clear}</Td>
                  <Td mono>{row.discrepancies}</Td>
                  <Td mono>{row.unableToVerify}</Td>
                  <Td mono>{row.pending}</Td>
                  <Td>
                    <ClientPill tone={row.discrepancies + row.unableToVerify ? "amber" : "green"}>
                      {row.returned
                        ? `${Math.round(((row.discrepancies + row.unableToVerify) / row.returned) * 100)}%`
                        : "No outcomes"}
                    </ClientPill>
                  </Td>
                </Row>
              ))}
            </tbody>
          </Table>
        </div>
        {!data.checkHealth.length && (
          <ClientEmpty title="No check outcomes yet">
            Results will appear as checks are returned.
          </ClientEmpty>
        )}
      </Card>
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,1fr)]">
        <Card className="min-w-0">
          <CardHeader
            title="Document quality"
            description="Current document records, grouped by type."
          />
          <div className="overflow-x-auto">
            <Table>
              <Head labels={["Type", "Total", "Verified", "Available", "Rejected"]} />
              <tbody>
                {data.documentHealth.map((row) => (
                  <Row key={row.type}>
                    <Td>
                      <Name title={humanize(row.type)} />
                    </Td>
                    <Td mono>{row.total}</Td>
                    <Td mono>{row.verified}</Td>
                    <Td mono>{row.available}</Td>
                    <Td>
                      <ClientPill tone={row.rejected ? "red" : "green"}>{row.rejected}</ClientPill>
                    </Td>
                  </Row>
                ))}
              </tbody>
            </Table>
          </div>
          {!data.documentHealth.length && (
            <ClientEmpty title="No document data">Uploads will populate this view.</ClientEmpty>
          )}
        </Card>
        <Card className="min-w-0">
          <CardHeader
            title="Quality decisions"
            description="Recorded QA decisions, not unique candidate counts."
          />
          <div className="flex flex-col gap-3 px-4 py-3">
            {decisions.length ? (
              <dl className="flex flex-col gap-3">
                {decisions.map(([label, count]) => (
                  <div key={label} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <dt className="text-ink">{humanize(label)}</dt>
                      <dd className="font-mono font-semibold text-ink">{count}</dd>
                    </div>
                    <Meter
                      value={count}
                      max={decisionTotal}
                      tone="note"
                      label={`${humanize(label)} share`}
                    />
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-dim">No QA decisions recorded yet.</p>
            )}
            <Link to="/client-portal/actions" className={LINK}>
              Review requested corrections →
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
