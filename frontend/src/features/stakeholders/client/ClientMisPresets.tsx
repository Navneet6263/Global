import { useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, ErrorText, Input, Loading, Row, Td, Th } from "@/kit";
import { COLOUR_CODES, hexFor } from "@/features/workflow-ui/colour-legend";
import {
  downloadMis,
  downloadRmMis,
  getMis,
  getRmMis,
  type MisPreset,
} from "@/lib/backend-api/client-reports";
import { PRESETS, monthAgo, today } from "./client-mis-model";

const swatch = "size-2 shrink-0 rounded-full";
const pill =
  "inline-flex items-center gap-1.5 rounded-full border border-line bg-subtle/60 px-2 py-0.5 text-xs font-medium text-ink";

/**
 * Ready-made MIS. For the Company Admin it is its own company; an RM passes `company`
 * (one of its assigned companies) and the same report is built for that company.
 */
export function PresetReports({ company }: { company?: { id: string; name: string } }) {
  const [preset, setPreset] = useState<MisPreset>("CASE_STATUS");
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const mis = useQuery({
    queryKey: ["client-reports", "mis", company?.id ?? "own", preset, from, to],
    queryFn: () => (company ? getRmMis(company.id, preset, from, to) : getMis(preset, from, to)),
    placeholderData: keepPreviousData,
  });
  const download = useMutation({
    mutationFn: () =>
      company
        ? downloadRmMis(company.id, company.name, preset, from, to)
        : downloadMis(preset, from, to),
    onError: (error: Error) => toast.error("Not downloaded", { description: error.message }),
  });
  const data = mis.data;
  return (
    <Card label="Ready-made reports" className="min-w-0">
      <CardHeader
        title="Ready-made reports"
        description="Pick a report, choose the dates, and download it with colour codes."
        aside={
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-dim">
              From
              <Input
                type="date"
                className="w-auto"
                value={from}
                max={to}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="Report from"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-dim">
              To
              <Input
                type="date"
                className="w-auto"
                value={to}
                min={from}
                max={today}
                onChange={(e) => setTo(e.target.value)}
                aria-label="Report to"
              />
            </label>
            <Button
              variant="primary"
              disabled={!data?.total}
              loading={download.isPending}
              onClick={() => download.mutate()}
            >
              <Download aria-hidden /> Download CSV
            </Button>
          </div>
        }
      />
      <div
        className="grid grid-cols-1 gap-2 px-4 pt-4 sm:grid-cols-2 xl:grid-cols-4"
        role="group"
        aria-label="Report preset"
      >
        {PRESETS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={preset === item.value}
            onClick={() => setPreset(item.value)}
            className="flex min-w-0 items-start gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-left transition hover:bg-subtle/60 aria-pressed:border-brand aria-pressed:bg-brand-soft"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-subtle text-dim">
              <item.icon aria-hidden className="size-4" />
            </span>
            <span className="flex min-w-0 flex-col">
              <strong className="text-sm font-semibold text-ink">{item.label}</strong>
              <small className="text-xs text-dim">{item.hint}</small>
            </span>
          </button>
        ))}
      </div>
      {data ? (
        <div
          className="flex flex-wrap items-center gap-2 px-4 pt-3"
          aria-label="Colour code summary"
        >
          <span className="mr-1 text-xs text-dim">
            <strong className="font-mono text-sm font-semibold text-ink tabular-nums">
              {data.total}
            </strong>{" "}
            rows
          </span>
          {COLOUR_CODES.filter((code) => data.colours[code.value]).map((code) => (
            <span key={code.value} className={pill}>
              <i className={swatch} style={{ background: code.hex }} aria-hidden />
              {code.label}
              <strong className="font-mono tabular-nums">{data.colours[code.value]}</strong>
            </span>
          ))}
          {data.colours["NONE"] ? (
            <span className={pill}>
              <i className={swatch} style={{ background: hexFor(null) }} aria-hidden />
              In progress
              <strong className="font-mono tabular-nums">{data.colours["NONE"]}</strong>
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="p-4">
        {mis.isError ? (
          <ErrorText>{mis.error.message}</ErrorText>
        ) : !data ? (
          <Loading>Preparing…</Loading>
        ) : !data.rows.length ? (
          <p className="px-4 py-6 text-center text-sm text-dim">Nothing in this date range.</p>
        ) : (
          <div className="max-w-full overflow-x-auto rounded-lg border border-line">
            <table
              className="w-full border-collapse text-sm text-ink"
              aria-label={`${data.title} preview`}
            >
              <thead>
                <tr>
                  {data.columns.map((column) => (
                    <Th key={column}>{column}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row, index) => (
                  <Row key={index}>
                    {row.cells.map((cell, column) => {
                      const last = column === row.cells.length - 1;
                      return (
                        <Td key={column} className={last ? "whitespace-nowrap" : undefined}>
                          {last && (data.preset !== "TAT" || row.colour) ? (
                            <span className="inline-flex items-center gap-1.5 font-medium">
                              <i
                                className={swatch}
                                style={{ background: hexFor(row.colour) }}
                                aria-hidden
                              />
                              {cell}
                            </span>
                          ) : (
                            cell
                          )}
                        </Td>
                      );
                    })}
                  </Row>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {data && data.total > data.rows.length ? (
        <p className="border-t border-line px-4 py-2.5 text-xs text-dim">
          Preview shows {data.rows.length} of {data.total} rows. The CSV has all of them.
        </p>
      ) : null}
    </Card>
  );
}
