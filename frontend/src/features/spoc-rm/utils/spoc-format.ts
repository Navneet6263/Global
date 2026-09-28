import { oversightLabel } from "@/features/admin-dashboard/oversight-format";
import { formatDate, formatDateTime, formatInr, formatRelativeToNow } from "@/lib/formatting";

export const label = (value: string | null | undefined) => (value ? oversightLabel(value) : "—");

export const date = (value: string | null | undefined) => (value ? formatDate(value) : "—");

export const dateTime = (value: string | null | undefined) => (value ? formatDateTime(value) : "—");

export const relative = (value: string | null | undefined) =>
  value ? formatRelativeToNow(value) : "—";

export const money = (value: number) => formatInr(value);

export const compactMoney = (value: number) => formatInr(value, { compact: true });

/** Oldest-case age in the same short form the delivery dashboards use. */
export function age(hours: number): string {
  if (hours <= 0) return "—";
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

/** YYYY-MM-DD for native date inputs. */
export function isoDay(value: string | undefined): string {
  return value ? value.slice(0, 10) : "";
}
