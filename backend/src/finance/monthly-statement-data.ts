import { BadRequestException } from "@nestjs/common";
import { csvCell, toPaise } from "./finance.shared";

export interface StatementEntry {
  at: Date;
  type: "INVOICE" | "PAYMENT" | "CREDIT_NOTE" | "CANCELLATION";
  reference: string;
  invoice: string;
  debit: bigint;
  credit: bigint;
}

export function statementPeriod(month: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))
    throw new BadRequestException("Choose a valid calendar month (YYYY-MM)");
  const [year, index] = month.split("-").map(Number) as [number, number];
  const next = new Date(Date.UTC(year, index, 1)).toISOString().slice(0, 10);
  return {
    start: new Date(`${month}-01T00:00:00+05:30`),
    end: new Date(`${next}T00:00:00+05:30`),
    invoiceEnd: new Date(`${next}T00:00:00Z`),
  };
}

export function invoiceStatementDate(issuedAt: Date | null, createdAt: Date) {
  return issuedAt
    ? new Date(`${issuedAt.toISOString().slice(0, 10)}T00:00:00+05:30`)
    : createdAt;
}

export function statementPaise(value: unknown): bigint {
  return BigInt(toPaise(value));
}

export function statementMoney(paise: bigint): string {
  const sign = paise < 0n ? "-" : "";
  const absolute = paise < 0n ? -paise : paise;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

export function buildMonthlyStatement(
  entries: StatementEntry[],
  month: string,
) {
  const { start, end } = statementPeriod(month);
  const sorted = entries
    .filter((item) => item.at < end)
    .sort(
      (a, b) =>
        a.at.getTime() - b.at.getTime() ||
        a.type.localeCompare(b.type) ||
        a.reference.localeCompare(b.reference),
    );
  const opening = sorted
    .filter((item) => item.at < start)
    .reduce((sum, item) => sum + item.debit - item.credit, 0n);
  let balance = opening;
  const rows = sorted
    .filter((item) => item.at >= start)
    .map((item) => {
      balance += item.debit - item.credit;
      return { ...item, balance };
    });
  return { opening, closing: balance, rows };
}

export function monthlyStatementCsv(
  entries: StatementEntry[],
  month: string,
  client: { code: string; displayName: string },
  now = new Date(),
) {
  const statement = buildMonthlyStatement(entries, month);
  const timestamp = (value: Date) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata",
      dateStyle: "short",
      timeStyle: "medium",
    }).format(value);
  const rows: Array<Array<string>> = [
    ["MONTHLY CLIENT STATEMENT", month],
    ["Client", client.displayName, client.code],
    ["Currency", "INR", "Calendar timezone", "Asia/Kolkata"],
    ["Generated", timestamp(now)],
    [
      "Basis",
      "Current recorded ledger: invoice issue dates, received payment dates, credit and cancellation record dates. Backdated entries may revise earlier periods.",
    ],
    ["Opening balance", statementMoney(statement.opening)],
    [],
    [
      "Date/time IST",
      "Entry",
      "Reference",
      "Invoice",
      "Debit INR",
      "Credit INR",
      "Running balance INR",
    ],
    ...statement.rows.map((row) => [
      timestamp(row.at),
      row.type,
      row.reference,
      row.invoice,
      statementMoney(row.debit),
      statementMoney(row.credit),
      statementMoney(row.balance),
    ]),
    [],
    ["Closing balance", statementMoney(statement.closing)],
  ];
  return {
    csv: `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`,
    count: statement.rows.length,
  };
}
