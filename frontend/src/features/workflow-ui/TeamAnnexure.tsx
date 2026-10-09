import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  EmptyState,
  LoadingState,
  Panel,
  SegmentTabs,
  StatCard,
} from "@/components/workspace/kit";
import { ExportSheetButton, type SheetColumn } from "@/components/workspace/export-sheet";
import { humanizeCode, istText } from "@/components/workspace/format";
import {
  downloadTeamAnnexure,
  getTeamAnnexure,
  type AnnexureItem,
  type AnnexurePeriod,
} from "@/lib/backend-api/rework";
import { ReworkDialog, type ReworkTarget } from "./ReworkDialog";
import { COLOUR_CODES, hexFor } from "./colour-legend";

const PERIODS: ReadonlyArray<{ id: AnnexurePeriod; label: string }> = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "year", label: "This year" },
];

// Built on the server (all rows, audited); the keys match its column names.
const EXPORT_COLUMNS: readonly SheetColumn<AnnexureItem>[] = [
  { key: "caseNumber", label: "Sapling ID", value: (i) => i.caseNumber },
  { key: "candidate", label: "Candidate", value: (i) => i.candidateName },
  { key: "client", label: "Client", value: (i) => i.clientName },
  { key: "check", label: "Check", value: (i) => i.checkType },
  { key: "verifier", label: "Verifier", value: (i) => i.verifier },
  { key: "completedAt", label: "Completed (IST)", value: (i) => i.completedAt },
  { key: "status", label: "Status", value: (i) => i.status },
  { key: "colour", label: "Colour code", value: (i) => i.colourLabel },
];
const EXPORT_DEFAULTS = EXPORT_COLUMNS.map((column) => column.key);

/** Team Leader annexure: the team's closed checks this week / month / year, colour coded. */
export function TeamAnnexure() {
  const [period, setPeriod] = useState<AnnexurePeriod>("month");
  const [target, setTarget] = useState<ReworkTarget | null>(null);
  const annexure = useQuery({
    queryKey: ["workflow", "team-annexure", period],
    queryFn: () => getTeamAnnexure(period),
  });
  const data = annexure.data;
  const periodLabel = PERIODS.find((item) => item.id === period)!.label;
  return (
    <div className="grid gap-4">
      <section
        aria-label="Colour code summary"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7"
      >
        <StatCard
          icon={CalendarCheck}
          tone="info"
          label="Closed checks"
          value={data?.total ?? "—"}
          hint={periodLabel}
        />
        {COLOUR_CODES.map((code) => (
          <div
            key={code.value}
            className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ background: code.hex }}
              aria-hidden
            />
            <span className="min-w-0">
              <small className="block truncate text-xs font-medium text-slate-500">
                {code.label}
              </small>
              <strong className="text-xl font-bold tabular-nums text-slate-900">
                {data ? (data.colours[code.value] ?? 0) : "—"}
              </strong>
            </span>
          </div>
        ))}
      </section>
      <Panel
        label="Team annexure"
        title="Closed by your team"
        count={data?.total}
        description="Every check your team closed in the period, with its colour code."
        actions={
          <>
            <SegmentTabs
              label="Annexure period"
              value={period}
              onChange={setPeriod}
              options={PERIODS}
            />
            <ExportSheetButton
              source="team-annexure"
              title="Export team annexure"
              filename="Sapling-Global-team-annexure"
              columns={EXPORT_COLUMNS}
              defaults={EXPORT_DEFAULTS}
              scopeNote={`${periodLabel.toLowerCase()} · all ${data?.total ?? 0} closed checks`}
              disabled={!data?.total}
              download={(columns) => downloadTeamAnnexure(period, columns)}
            />
          </>
        }
      >
        {annexure.isError ? (
          <EmptyState tone="bad" title="Annexure unavailable" detail={annexure.error.message} />
        ) : !data ? (
          <LoadingState />
        ) : !data.items.length ? (
          <EmptyState
            icon={CalendarCheck}
            tone="neutral"
            title="Nothing closed yet"
            detail="Closed checks for this period will appear here."
          />
        ) : (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {data.items.map((item) => (
              <li
                key={item.checkId}
                className="grid gap-3 px-5 py-3.5 transition hover:bg-slate-50 lg:grid-cols-[minmax(200px,1.2fr)_minmax(110px,0.6fr)_minmax(140px,0.8fr)_minmax(150px,0.9fr)_130px] lg:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={item.candidateName} />
                  <div className="min-w-0">
                    <strong className="block truncate text-[13.5px] text-slate-900">
                      {item.candidateName}
                    </strong>
                    <small className="block truncate text-[11.5px] text-slate-500">
                      {item.clientName} · {item.caseNumber}
                    </small>
                  </div>
                </div>
                <span className="text-[13px] font-medium text-slate-700">
                  {humanizeCode(item.checkType)}
                </span>
                <span className="text-[12.5px] text-slate-600">
                  {item.verifier ?? "—"}
                  <small className="block text-[11.5px] text-slate-400">
                    {istText(item.completedAt) || "—"}
                  </small>
                </span>
                <span className="inline-flex items-center gap-2 text-[12.5px] font-medium text-slate-700">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: hexFor(item.colour) }}
                    aria-hidden
                  />
                  {item.status}
                </span>
                <span className="flex justify-end">
                  {item.canSendBack ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setTarget({
                          checkId: item.checkId,
                          mode: "REJECT",
                          label: `${item.caseNumber} · ${humanizeCode(item.checkType)}`,
                        })
                      }
                    >
                      <Undo2 aria-hidden /> Send back
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
        {data && data.total > data.items.length ? (
          <p className="border-t border-slate-100 px-5 py-3 text-[12.5px] text-slate-500">
            Showing the latest {data.items.length} of {data.total}. Export downloads all of them.
          </p>
        ) : null}
      </Panel>
      <ReworkDialog
        target={target}
        onClose={() => setTarget(null)}
        onDone={() => annexure.refetch()}
      />
    </div>
  );
}
