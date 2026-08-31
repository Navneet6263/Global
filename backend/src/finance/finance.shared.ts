import type { Actor } from "../common/auth/actor";

export const settledInvoiceStatuses = [
  "PAID",
  "CANCELLED",
  "CREDITED",
  "SETTLED",
] as const;

export const invoiceSelect = {
  publicId: true,
  invoiceNumber: true,
  status: true,
  currency: true,
  issuedAt: true,
  dueAt: true,
  subtotal: true,
  taxAmount: true,
  totalAmount: true,
  paidAmount: true,
  creditedAmount: true,
  notes: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { publicId: true, displayName: true, code: true } },
  lines: {
    select: {
      id: true,
      description: true,
      quantity: true,
      unitPrice: true,
      taxRate: true,
      lineTotal: true,
      case: { select: { publicId: true, caseNumber: true } },
    },
  },
  payments: {
    select: {
      publicId: true,
      amount: true,
      method: true,
      reference: true,
      receivedAt: true,
      createdAt: true,
    },
    orderBy: { receivedAt: "desc" as const },
  },
  creditNotes: {
    select: {
      publicId: true,
      noteNumber: true,
      amount: true,
      reason: true,
      createdAt: true,
      createdBy: { select: { displayName: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
} as const;

export function clientScope(actor: Actor) {
  return actor.clientId ? { clientId: actor.clientId } : {};
}

export function isSettledInvoice(status: string) {
  return settledInvoiceStatuses.includes(
    status as (typeof settledInvoiceStatuses)[number],
  );
}

export function presentInvoice<
  T extends { publicId: string; status: string; dueAt: Date | null },
>(row: T, now: Date) {
  const { publicId, ...invoice } = row;
  const status =
    !isSettledInvoice(invoice.status) && invoice.dueAt && invoice.dueAt < now
      ? "OVERDUE"
      : invoice.status;
  return { id: publicId, ...invoice, status };
}

export function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function toPaise(value: unknown) {
  const text = moneyText(value);
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error(`Invalid two-decimal money value: ${text}`);
  const paise =
    BigInt(match[2]!) * 100n + BigInt((match[3] ?? "").padEnd(2, "0"));
  const signed = match[1] ? -paise : paise;
  const result = Number(signed);
  if (!Number.isSafeInteger(result)) throw new Error("Money value exceeds safe paise range");
  return result;
}

function moneyText(value: unknown) {
  if (value === null || value === undefined) return "0";
  if (typeof value === "number") return value.toFixed(2);
  if (typeof value === "string" || typeof value === "bigint") {
    return value.toString();
  }
  if (
    typeof value === "object" &&
    "toString" in value &&
    typeof value.toString === "function"
  ) {
    const text = (value as { toString(): string }).toString();
    if (text !== "[object Object]") return text;
  }
  throw new Error("Money value must be numeric");
}

export function fromPaise(value: number) {
  return value / 100;
}
