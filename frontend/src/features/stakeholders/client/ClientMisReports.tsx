import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlarmClock, Download, FileArchive } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Input, Select } from "@/kit";
import { COLOUR_CODES } from "@/features/workflow-ui/colour-legend";
import {
  createMisSchedule,
  deleteMisSchedule,
  downloadBulkReports,
  getMisSchedules,
  type MisFrequency,
  type MisPreset,
} from "@/lib/backend-api/client-reports";
import type { Disposition } from "@/lib/backend-api/rework";
import { formatDateTime } from "@/lib/formatting";
import { PresetReports } from "./ClientMisPresets";
import {
  FREQUENCIES,
  PRESETS,
  fieldLabel,
  monthAgo,
  presetLabel,
  sectionLabel,
  today,
} from "./client-mis-model";

export { PresetReports } from "./ClientMisPresets";

/**
 * Company Admin MIS (BGV process): ready-made Case status / TAT / UTV / Discrepancy
 * reports with colour codes, bulk download of released reports, and MIS by email on a
 * daily / weekly / monthly schedule.
 */
export function ClientMisReports() {
  return (
    <div className="grid min-w-0 gap-5">
      <PresetReports />
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
        <BulkDownload />
        <Schedules />
      </div>
    </div>
  );
}

function CardTitle({ icon: Icon, children }: { icon: typeof Download; children: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Icon aria-hidden className="size-4 text-brand" /> {children}
    </span>
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
    <Card label="Bulk report download" className="min-w-0">
      <CardHeader
        title={<CardTitle icon={FileArchive}>Bulk report download</CardTitle>}
        description="Every released report in the dates you choose, as one ZIP (up to 50)."
      />
      <div className="grid gap-3 p-4 sm:grid-cols-3">
        <label className={fieldLabel}>
          <span>Released from</span>
          <Input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="Bulk from"
          />
        </label>
        <label className={fieldLabel}>
          <span>Released to</span>
          <Input
            type="date"
            value={to}
            min={from}
            max={today}
            onChange={(e) => setTo(e.target.value)}
            aria-label="Bulk to"
          />
        </label>
        <label className={fieldLabel}>
          <span>Colour code</span>
          <Select
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
          </Select>
        </label>
      </div>
      <div className="flex justify-end border-t border-line px-4 py-3">
        <Button
          variant="primary"
          size="sm"
          loading={download.isPending}
          onClick={() => download.mutate()}
        >
          <Download aria-hidden /> Download ZIP
        </Button>
      </div>
    </Card>
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
    <Card label="Scheduled MIS" className="min-w-0">
      <CardHeader
        title={<CardTitle icon={AlarmClock}>Scheduled MIS</CardTitle>}
        description="Get a report by email at 08:00 IST, daily, weekly or monthly."
      />
      <div className="grid gap-3 p-4 sm:grid-cols-2">
        <label className={fieldLabel}>
          <span>Report</span>
          <Select
            value={preset}
            onChange={(e) => setPreset(e.target.value as MisPreset)}
            aria-label="Scheduled report"
          >
            {PRESETS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </label>
        <label className={fieldLabel}>
          <span>How often</span>
          <Select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as MisFrequency)}
            aria-label="Schedule frequency"
          >
            {FREQUENCIES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <fieldset className="m-0 grid min-w-0 gap-2 border-0 px-4 pb-4">
        <legend className={`${sectionLabel} mb-2`}>
          Send to (people in your company, up to 5)
        </legend>
        {(schedules.data?.recipients ?? []).map((person) => (
          <label
            key={person.email}
            className="flex min-w-0 cursor-pointer items-center gap-2.5 rounded-md border border-line px-3 py-2 text-sm text-ink transition hover:bg-subtle/60 has-checked:border-brand has-checked:bg-brand-soft has-disabled:cursor-not-allowed has-disabled:opacity-60"
          >
            <input
              type="checkbox"
              className="size-4 shrink-0 accent-brand"
              checked={recipients.includes(person.email)}
              disabled={!recipients.includes(person.email) && recipients.length >= 5}
              onChange={() => toggle(person.email)}
            />
            <span className="min-w-0 truncate">
              <span className="font-medium">{person.displayName}</span>{" "}
              <small className="text-xs text-dim">{person.email}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex justify-end border-t border-line px-4 py-3">
        <Button
          variant="primary"
          size="sm"
          disabled={!recipients.length}
          loading={create.isPending}
          onClick={() => create.mutate()}
        >
          Schedule
        </Button>
      </div>
      {schedules.data?.items.length ? (
        <ul className="border-t border-line" aria-label="Active schedules">
          {schedules.data.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <strong className="text-sm font-semibold text-ink">
                  {presetLabel(item.preset)} · {item.frequency.toLowerCase()}
                </strong>
                <small className="text-xs break-words text-dim">
                  To {item.recipients.join(", ")} · next {formatDateTime(item.nextRunAt)}
                </small>
              </div>
              <Button
                size="sm"
                variant="secondary"
                loading={remove.isPending && remove.variables === item.id}
                onClick={() => remove.mutate(item.id)}
              >
                Stop
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
