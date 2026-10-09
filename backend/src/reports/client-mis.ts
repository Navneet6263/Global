import {
  DispositionLabels,
  caseColour,
  effectiveDisposition,
  type Disposition,
} from "../verification/dispositions";
import { checkStatusLabel } from "../verification/verified-fields";

export const MIS_PRESETS = [
  "CASE_STATUS",
  "TAT",
  "UTV",
  "DISCREPANCY",
] as const;
export type MisPreset = (typeof MIS_PRESETS)[number];
export const MIS_FREQUENCIES = ["DAILY", "WEEKLY", "MONTHLY"] as const;
export type MisFrequency = (typeof MIS_FREQUENCIES)[number];

export const MIS_TITLES: Record<MisPreset, string> = {
  CASE_STATUS: "Case status",
  TAT: "Turnaround time (TAT)",
  UTV: "Unable to verify (UTV)",
  DISCREPANCY: "Discrepancy",
};

/** Findings stay private until the report is released (QC + manager approved). */
const RELEASED = ["COMPLETED", "CLOSED"];

export type MisCase = {
  caseNumber: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  dueAt: Date | null;
  subject: { fullName: string };
  checks: Array<{
    type: string;
    result: string | null;
    disposition: string | null;
    sourceSummary: string | null;
    completedAt: Date | null;
  }>;
};

const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
});
export const istDay = (value: Date | null) => (value ? IST.format(value) : "");
const readable = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());
const colourLabel = (colour: Disposition | null) =>
  colour ? DispositionLabels[colour] : "In progress";

export const MIS_COLUMNS: Record<MisPreset, string[]> = {
  CASE_STATUS: [
    "Sapling ID",
    "Candidate",
    "Status",
    "Initiated",
    "Completed",
    "Checks done",
    "Colour code",
  ],
  TAT: [
    "Sapling ID",
    "Candidate",
    "Initiated",
    "Due",
    "Completed",
    "TAT (days)",
    "Within TAT",
  ],
  UTV: ["Sapling ID", "Candidate", "Check", "Closed", "Reason", "Colour code"],
  DISCREPANCY: [
    "Sapling ID",
    "Candidate",
    "Check",
    "Status",
    "Closed",
    "Remarks",
    "Colour code",
  ],
};

/** Rows (cells in MIS_COLUMNS order) plus each row's colour for the colour code. */
export function misRows(
  preset: MisPreset,
  cases: readonly MisCase[],
  now = new Date(),
): Array<{ cells: string[]; colour: Disposition | null }> {
  if (preset === "CASE_STATUS")
    return cases.map((row) => {
      const done = row.checks.filter((check) => check.result).length;
      const colour = RELEASED.includes(row.status)
        ? caseColour(row.checks)
        : null;
      return {
        colour,
        cells: [
          row.caseNumber,
          row.subject.fullName,
          readable(row.status),
          istDay(row.createdAt),
          istDay(row.completedAt),
          `${done}/${row.checks.length}`,
          colourLabel(colour),
        ],
      };
    });
  if (preset === "TAT")
    return cases.map((row) => {
      const end = row.completedAt ?? now;
      const days = Math.max(
        0,
        Math.round((end.getTime() - row.createdAt.getTime()) / 86_400_000),
      );
      const within = row.dueAt ? end <= row.dueAt : null;
      return {
        colour: within === null ? null : within ? "GREEN" : "RED",
        cells: [
          row.caseNumber,
          row.subject.fullName,
          istDay(row.createdAt),
          istDay(row.dueAt),
          istDay(row.completedAt),
          String(days),
          within === null
            ? "No due date"
            : within
              ? "Yes"
              : row.completedAt
                ? "No"
                : "No (open)",
        ],
      };
    });
  const wanted = preset === "UTV" ? "UNABLE_TO_VERIFY" : "DISCREPANCY";
  return cases.flatMap((row) =>
    row.checks
      .filter((check) => check.result === wanted)
      .map((check) => {
        const released = RELEASED.includes(row.status);
        const colour = released ? effectiveDisposition(check) : null;
        const remark = released
          ? (check.sourceSummary ?? "").slice(0, 300)
          : "Under review — shared with the report";
        return {
          colour,
          cells:
            preset === "UTV"
              ? [
                  row.caseNumber,
                  row.subject.fullName,
                  readable(check.type),
                  istDay(check.completedAt),
                  remark,
                  colourLabel(colour),
                ]
              : [
                  row.caseNumber,
                  row.subject.fullName,
                  readable(check.type),
                  released
                    ? checkStatusLabel(check.type, check.result, colour)
                    : "Under review",
                  istDay(check.completedAt),
                  remark,
                  colourLabel(colour),
                ],
        };
      }),
  );
}

/** Byte-order mark so Excel opens the UTF-8 CSV correctly. */
const BOM = String.fromCharCode(0xfeff);
const cell = (value: string) => {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

export function misCsv(
  preset: MisPreset,
  rows: ReadonlyArray<{ cells: string[] }>,
) {
  return `${BOM}${[MIS_COLUMNS[preset], ...rows.map((row) => row.cells)]
    .map((line) => line.map(cell).join(","))
    .join("\r\n")}`;
}

/** Next run at 08:00 IST after `from`: tomorrow, next Monday, or the 1st of next month. */
export function nextMisRun(frequency: MisFrequency, from = new Date()) {
  const ist = new Date(from.getTime() + 330 * 60_000);
  const next = new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 8),
  );
  if (frequency === "DAILY") next.setUTCDate(next.getUTCDate() + 1);
  if (frequency === "WEEKLY")
    next.setUTCDate(next.getUTCDate() + ((8 - next.getUTCDay()) % 7 || 7));
  if (frequency === "MONTHLY") next.setUTCMonth(next.getUTCMonth() + 1, 1);
  return new Date(next.getTime() - 330 * 60_000);
}

/** The period a scheduled MIS covers, ending now. */
export function misWindow(frequency: MisFrequency, now = new Date()) {
  const days = frequency === "DAILY" ? 1 : frequency === "WEEKLY" ? 7 : 31;
  return { from: new Date(now.getTime() - days * 86_400_000), to: now };
}
