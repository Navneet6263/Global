import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlarmClock,
  CircleHelp,
  Download,
  FileArchive,
  GaugeCircle,
  ListChecks,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { COLOUR_CODES, hexFor } from "@/features/workflow-ui/colour-legend";
import {
  createMisSchedule,
  deleteMisSchedule,
  downloadBulkReports,
  downloadMis,
  downloadRmMis,
  getMis,
  getRmMis,
  getMisSchedules,
  type MisFrequency,
  type MisPreset,
} from "@/lib/backend-api/client-reports";
import type { Disposition } from "@/lib/backend-api/rework";
import { formatDateTime } from "@/lib/formatting";

const PRESETS: Array<{ value: MisPreset; label: string; hint: string; icon: LucideIcon }> = [
  {
    value: "CASE_STATUS",
    label: "Case status",
    hint: "Every case and where it is",
    icon: ListChecks,
  },
  { value: "TAT", label: "TAT", hint: "Turnaround and cases past due", icon: GaugeCircle },
  { value: "UTV", label: "UTV", hint: "Checks unable to verify", icon: CircleHelp },
  {
    value: "DISCREPANCY",
    label: "Discrepancy",
    hint: "Checks with a discrepancy",
    icon: TriangleAlert,
  },
];
const FREQUENCIES: Array<{ value: MisFrequency; label: string }> = [
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly (Monday)" },
  { value: "MONTHLY", label: "Monthly (1st)" },
];
const presetLabel = (value: MisPreset) => PRESETS.find((item) => item.value === value)?.label;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const today = isoDay(new Date());
const monthAgo = isoDay(new Date(Date.now() - 30 * 86_400_000));

/**
 * Company Admin MIS (BGV process): ready-made Case status / TAT / UTV / Discrepancy
 * reports with colour codes, bulk download of released reports, and MIS by email on a
 * daily / weekly / monthly schedule.
 */
export function ClientMisReports() {
  return (
    <div className="grid min-w-0 gap-5">
      <PresetReports />
      <div className="mis-split">
        <BulkDownload />
        <Schedules />
      </div>
    </div>
  );
}

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
    <section className="mis-card" aria-label="Ready-made reports">
      <header className="mis-head">
        <div>
          <h2>Ready-made reports</h2>
          <p>Pick a report, choose the dates, and download it with colour codes.</p>
        </div>
        <div className="mis-range">
          <label>
            From
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="Report from"
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(e) => setTo(e.target.value)}
              aria-label="Report to"
            />
          </label>
          <Button
            size="sm"
            disabled={!data?.total}
            loading={download.isPending}
            onClick={() => download.mutate()}
          >
            <Download aria-hidden /> Download CSV
          </Button>
        </div>
      </header>
      <div className="mis-presets" role="group" aria-label="Report preset">
        {PRESETS.map((item) => (
          <button
            key={item.value}
            type="button"
            aria-pressed={preset === item.value}
            onClick={() => setPreset(item.value)}
          >
            <item.icon aria-hidden />
            <span>
              <strong>{item.label}</strong>
              <small>{item.hint}</small>
            </span>
          </button>
        ))}
      </div>
      {data ? (
        <div className="ann-colours mis-colours" aria-label="Colour code summary">
          <span className="ann-total">
            <strong>{data.total}</strong> rows
          </span>
          {COLOUR_CODES.filter((code) => data.colours[code.value]).map((code) => (
            <span key={code.value} className="ann-chip">
              <i style={{ background: code.hex }} aria-hidden />
              {code.label}
              <strong>{data.colours[code.value]}</strong>
            </span>
          ))}
          {data.colours["NONE"] ? (
            <span className="ann-chip">
              <i style={{ background: hexFor(null) }} aria-hidden />
              In progress
              <strong>{data.colours["NONE"]}</strong>
            </span>
          ) : null}
        </div>
      ) : null}
      {mis.isError ? (
        <p className="mis-empty">{mis.error.message}</p>
      ) : !data ? (
        <p className="mis-empty">Preparing…</p>
      ) : !data.rows.length ? (
        <p className="mis-empty">Nothing in this date range.</p>
      ) : (
        <div className="rmo-table-scroll">
          <table className="rmo-table" aria-label={`${data.title} preview`}>
            <thead>
              <tr>
                {data.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, index) => (
                <tr key={index}>
                  {row.cells.map((cell, column) => (
                    <td
                      key={column}
                      className={column === row.cells.length - 1 ? "whitespace-nowrap" : undefined}
                    >
                      {column === row.cells.length - 1 && (data.preset !== "TAT" || row.colour) ? (
                        <span className="ann-status">
                          <i style={{ background: hexFor(row.colour) }} aria-hidden />
                          {cell}
                        </span>
                      ) : (
                        cell
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > data.rows.length ? (
        <p className="mis-foot">
          Preview shows {data.rows.length} of {data.total} rows. The CSV has all of them.
        </p>
      ) : null}
    </section>
  );
}

function BulkDownload() {
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [colour, setColour] = useState<Disposition | "">("");
  const download = useMutation({
    mutationFn: () => downloadBulkReports(from, to, colour || undefined),
    onSuccess: () =>
      toast.success("Reports downloaded", { description: "The ZIP has an index.csv." }),
    onError: (error: Error) => toast.error("Nothing downloaded", { description: error.message }),
  });
  return (
    <section className="mis-card" aria-label="Bulk report download">
      <header className="mis-head">
        <div>
          <h2>
            <FileArchive aria-hidden /> Bulk report download
          </h2>
          <p>Every released report in the dates you choose, as one ZIP (up to 50).</p>
        </div>
      </header>
      <div className="mis-form">
        <label className="ops-field">
          <span>Released from</span>
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="Bulk from"
          />
        </label>
        <label className="ops-field">
          <span>Released to</span>
          <input
            type="date"
            value={to}
            min={from}
            max={today}
            onChange={(e) => setTo(e.target.value)}
            aria-label="Bulk to"
          />
        </label>
        <label className="ops-field">
          <span>Colour code</span>
          <select
            value={colour}
            onChange={(e) => setColour(e.target.value as Disposition | "")}
            aria-label="Bulk colour code"
          >
            <option value="">All colours</option>
            {COLOUR_CODES.map((code) => (
              <option key={code.value} value={code.value}>
                {code.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mis-actions">
        <Button size="sm" loading={download.isPending} onClick={() => download.mutate()}>
          <Download aria-hidden /> Download ZIP
        </Button>
      </div>
    </section>
  );
}

function Schedules() {
  const queryClient = useQueryClient();
  const schedules = useQuery({
    queryKey: ["client-reports", "schedules"],
    queryFn: getMisSchedules,
  });
  const [preset, setPreset] = useState<MisPreset>("CASE_STATUS");
  const [frequency, setFrequency] = useState<MisFrequency>("WEEKLY");
  const [recipients, setRecipients] = useState<string[]>([]);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["client-reports", "schedules"] });
  const create = useMutation({
    mutationFn: () => createMisSchedule({ preset, frequency, recipients }),
    onSuccess: async (result) => {
      toast.success("MIS scheduled", {
        description: `First email ${formatDateTime(result.nextRunAt)}.`,
      });
      setRecipients([]);
      await refresh();
    },
    onError: (error: Error) => toast.error("Not scheduled", { description: error.message }),
  });
  const remove = useMutation({
    mutationFn: deleteMisSchedule,
    onSuccess: async () => {
      toast.success("Schedule stopped");
      await refresh();
    },
    onError: (error: Error) => toast.error("Not stopped", { description: error.message }),
  });
  const toggle = (email: string) =>
    setRecipients((current) =>
      current.includes(email) ? current.filter((value) => value !== email) : [...current, email],
    );
  return (
    <section className="mis-card" aria-label="Scheduled MIS">
      <header className="mis-head">
        <div>
          <h2>
            <AlarmClock aria-hidden /> Scheduled MIS
          </h2>
          <p>Get a report by email at 08:00 IST, daily, weekly or monthly.</p>
        </div>
      </header>
      <div className="mis-form">
        <label className="ops-field">
          <span>Report</span>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as MisPreset)}
            aria-label="Scheduled report"
          >
            {PRESETS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="ops-field">
          <span>How often</span>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as MisFrequency)}
            aria-label="Schedule frequency"
          >
            {FREQUENCIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset className="mis-recipients">
        <legend>Send to (people in your company, up to 5)</legend>
        {(schedules.data?.recipients ?? []).map((person) => (
          <label key={person.email}>
            <input
              type="checkbox"
              checked={recipients.includes(person.email)}
              disabled={!recipients.includes(person.email) && recipients.length >= 5}
              onChange={() => toggle(person.email)}
            />
            <span>
              {person.displayName} <small>{person.email}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="mis-actions">
        <Button
          size="sm"
          disabled={!recipients.length}
          loading={create.isPending}
          onClick={() => create.mutate()}
        >
          Schedule
        </Button>
      </div>
      {schedules.data?.items.length ? (
        <ul className="mis-schedules" aria-label="Active schedules">
          {schedules.data.items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>
                  {presetLabel(item.preset)} · {item.frequency.toLowerCase()}
                </strong>
                <small>
                  To {item.recipients.join(", ")} · next {formatDateTime(item.nextRunAt)}
                </small>
              </div>
              <Button
                size="sm"
                variant="outline"
                loading={remove.isPending && remove.variables === item.id}
                onClick={() => remove.mutate(item.id)}
              >
                Stop
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
