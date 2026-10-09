/**
 * Working-hour escalation rules from the BGV process document:
 * a step waiting more than 6 working hours alerts the owner, their lead and the Operations
 * Manager in red; after 8 working hours the head of department (platform administrator) is told.
 */
export interface WorkingCalendar {
  /** ISO weekdays, 1 = Monday ... 7 = Sunday. */
  days: number[];
  openMinute: number;
  closeMinute: number;
  /** Minutes east of UTC (India = 330). */
  offsetMinutes: number;
}

export const DEFAULT_CALENDAR: WorkingCalendar = {
  days: [1, 2, 3, 4, 5, 6],
  openMinute: 9 * 60 + 30,
  closeMinute: 18 * 60 + 30,
  offsetMinutes: 330,
};

export const ALERT_THRESHOLDS = [
  { level: "RED", workingMinutes: 6 * 60 },
  { level: "HOD", workingMinutes: 8 * 60 },
] as const;
export type AlertLevel = (typeof ALERT_THRESHOLDS)[number]["level"];

/** Reads WORKING_DAYS ("1-6" or "1,2,3") and WORKING_HOURS ("09:30-18:30"); invalid values fall back. */
export function calendarFromEnv(
  days?: string,
  hours?: string,
): WorkingCalendar {
  const parsedDays = parseDays(days);
  const match = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(
    hours?.trim() ?? "",
  );
  const open = match ? Number(match[1]) * 60 + Number(match[2]) : NaN;
  const close = match ? Number(match[3]) * 60 + Number(match[4]) : NaN;
  const validHours =
    Number.isFinite(open) &&
    Number.isFinite(close) &&
    open < close &&
    close <= 1440;
  return {
    ...DEFAULT_CALENDAR,
    days: parsedDays ?? DEFAULT_CALENDAR.days,
    ...(validHours ? { openMinute: open, closeMinute: close } : {}),
  };
}

function parseDays(value?: string) {
  const text = value?.trim();
  if (!text) return null;
  const range = /^([1-7])-([1-7])$/.exec(text);
  if (range) {
    const from = Number(range[1]);
    const to = Number(range[2]);
    return from <= to
      ? Array.from({ length: to - from + 1 }, (_, i) => from + i)
      : null;
  }
  const list = text.split(",").map((part) => Number(part.trim()));
  return list.length &&
    list.every((day) => Number.isInteger(day) && day >= 1 && day <= 7)
    ? [...new Set(list)]
    : null;
}

/** Working minutes between two instants, counting only open hours on working days. */
export function workingMinutesBetween(
  start: Date,
  end: Date,
  calendar = DEFAULT_CALENDAR,
) {
  if (!(end > start)) return 0;
  const shift = calendar.offsetMinutes * 60_000;
  const localStart = start.getTime() + shift;
  const localEnd = end.getTime() + shift;
  const dayMs = 86_400_000;
  let total = 0;
  for (
    let day = Math.floor(localStart / dayMs) * dayMs;
    day < localEnd;
    day += dayMs
  ) {
    const weekday = ((new Date(day).getUTCDay() + 6) % 7) + 1;
    if (!calendar.days.includes(weekday)) continue;
    const open = day + calendar.openMinute * 60_000;
    const close = day + calendar.closeMinute * 60_000;
    const from = Math.max(open, localStart);
    const to = Math.min(close, localEnd);
    if (to > from) total += (to - from) / 60_000;
  }
  return Math.floor(total);
}

export type WaitingStage =
  | "NEEDS_RM"
  | "AWAITING_DATA_ENTRY"
  | "DATA_ENTRY"
  | "READY_TO_ROUTE"
  | "TEAM_ASSIGNMENT";

export const STAGE_LABELS: Record<WaitingStage, string> = {
  NEEDS_RM: "waiting for an RM",
  AWAITING_DATA_ENTRY: "waiting for the RM to assign Data Entry",
  DATA_ENTRY: "with Data Entry",
  READY_TO_ROUTE: "Ready, waiting for the RM to route checks",
  TEAM_ASSIGNMENT: "routed, waiting for a Team Leader to assign a member",
};

export interface StageCase {
  status: string;
  workflowVersion: number;
  intakeStage: string | null;
  assignedOpsUserId: bigint | null;
  dataEntryAssignedAt: Date | null;
  dataEntryReadyAt: Date | null;
  createdAt: Date;
  documentPendingSince: Date | null;
  oldestUnassignedRoutedAt: Date | null;
}

/** The internal step a case is waiting at and since when; null when the wait is external. */
export function waitingStage(
  item: StageCase,
): { stage: WaitingStage; since: Date } | null {
  const intakeOpen = [
    "DOCUMENT_PENDING",
    "IN_PROGRESS",
    "CLARIFICATION_PENDING",
  ].includes(item.status);
  if (!intakeOpen) return null;
  if (!item.assignedOpsUserId)
    return {
      stage: "NEEDS_RM",
      since: item.documentPendingSince ?? item.createdAt,
    };
  if (item.workflowVersion !== 2) return null;
  if (item.status === "DOCUMENT_PENDING") {
    if (item.intakeStage === "INTAKE")
      return {
        stage: "AWAITING_DATA_ENTRY",
        since: item.documentPendingSince ?? item.createdAt,
      };
    if (item.intakeStage === "DATA_ENTRY" && item.dataEntryAssignedAt)
      return { stage: "DATA_ENTRY", since: item.dataEntryAssignedAt };
    if (item.intakeStage === "READY" && item.dataEntryReadyAt)
      return { stage: "READY_TO_ROUTE", since: item.dataEntryReadyAt };
    return null; // CORRECTION waits on the candidate or client.
  }
  if (item.oldestUnassignedRoutedAt)
    return { stage: "TEAM_ASSIGNMENT", since: item.oldestUnassignedRoutedAt };
  return null;
}

/** Alert levels already due for a wait that started at `since`. */
export function dueAlerts(
  since: Date,
  now: Date,
  calendar = DEFAULT_CALENDAR,
): AlertLevel[] {
  const waited = workingMinutesBetween(since, now, calendar);
  return ALERT_THRESHOLDS.filter(
    (threshold) => waited >= threshold.workingMinutes,
  ).map((threshold) => threshold.level);
}
