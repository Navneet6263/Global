import type { StatusTone } from "@/lib/contracts/common";
import { downloadExcel, type ExcelTone } from "@/lib/excel-export";
import type { RmClientProfile } from "@/lib/backend-api/rm-client-profile";
import { spocApi, type SpocDomainRows } from "../api/spoc-api";
import { HOLDER_LABEL, statusTone } from "../config/spoc-meta";
import type { SpocCaseRow, SpocDomain, SpocInvoiceRow } from "../contracts/spoc";
import { label } from "../utils/spoc-format";

/** Every row of one record type for this client, page by page (the API caps a page at 100). */
async function allRows<D extends SpocDomain>(domain: D, clientId: string, cap = 30) {
  const rows: SpocDomainRows[D][] = [];
  for (let page = 1; page <= cap; page += 1) {
    const result = await spocApi.records(domain, { clientId, page, pageSize: 100 });
    rows.push(...result.items);
    if (rows.length >= result.total || !result.items.length) break;
  }
  return rows;
}

const EXCEL_TONE: Record<StatusTone, ExcelTone | null> = {
  success: "ok",
  info: "info",
  warning: "warn",
  critical: "danger",
  review: "info",
  neutral: "neutral",
};
const toneOf = (status: string) => EXCEL_TONE[statusTone(status)];

/**
 * The whole client in one styled workbook: summary, every case, invoices with totals,
 * packages and logins. Built in the browser from the same data the RM sees on screen.
 */
export async function downloadClientDossier(profile: RmClientProfile) {
  const { company } = profile;
  const [cases, invoices] = await Promise.all([
    allRows("cases", company.id),
    allRows("invoices", company.id),
  ]);
  const generated = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const summary: Array<{ field: string; value: string | number }> = [
    { field: "Company", value: company.name },
    { field: "Legal name", value: company.legalName },
    { field: "Code", value: company.code },
    { field: "Status", value: label(company.status) },
    {
      field: "Came from",
      value: company.source === "SELF_SIGNUP" ? "Self sign-up" : "Added by Sapling",
    },
    { field: "Company RM", value: company.rm?.name ?? "No company RM" },
    { field: "Contact person", value: company.contactName ?? "—" },
    { field: "Contact email", value: company.contactEmail ?? "—" },
    { field: "Contact phone", value: company.contactPhone ?? "—" },
    { field: "GSTIN", value: company.gstin ?? "—" },
    { field: "Billing address", value: company.billingAddress ?? "—" },
    { field: "SLA (hours)", value: company.slaHours },
    { field: "Open cases", value: profile.numbers.openCases },
    { field: "Overdue cases", value: profile.numbers.overdueCases },
    { field: "Completed cases", value: profile.numbers.completedCases },
    { field: "Cases in this file", value: cases.length },
    { field: "Invoices in this file", value: invoices.length },
  ];
  await downloadExcel({
    fileName: `Sapling-Global-${company.code}-client-dossier`,
    title: `${company.name} — client dossier`,
    lines: [`${company.legalName} · ${company.code}`, `Generated ${generated} IST`],
    sheets: [
      {
        name: "Summary",
        columns: [
          { label: "Field", value: (row: (typeof summary)[number]) => row.field, width: 24 },
          { label: "Value", value: (row: (typeof summary)[number]) => row.value, width: 60 },
        ],
        rows: summary,
      },
      {
        name: "Cases",
        columns: [
          { label: "Case", value: (row: SpocCaseRow) => row.caseNumber },
          { label: "Candidate", value: (row: SpocCaseRow) => row.candidateName },
          {
            label: "Status",
            value: (row: SpocCaseRow) => label(row.status),
            tone: (row: SpocCaseRow) => toneOf(row.status),
          },
          { label: "With", value: (row: SpocCaseRow) => HOLDER_LABEL[row.holderRole] },
          { label: "Owner", value: (row: SpocCaseRow) => row.currentOwner },
          {
            label: "Checks done",
            value: (row: SpocCaseRow) => `${row.checksCompleted}/${row.checksTotal}`,
          },
          { label: "Created", type: "date", value: (row: SpocCaseRow) => row.createdAt },
          { label: "Due", type: "datetime", value: (row: SpocCaseRow) => row.dueAt },
          { label: "Completed", type: "date", value: (row: SpocCaseRow) => row.completedAt },
          {
            label: "Overdue",
            value: (row: SpocCaseRow) => (row.overdue ? "Yes" : "No"),
            tone: (row: SpocCaseRow) => (row.overdue ? "danger" : null),
          },
          { label: "Priority", value: (row: SpocCaseRow) => label(row.priority) },
          { label: "Ref", value: (row: SpocCaseRow) => row.externalRef },
        ],
        rows: cases,
        note: cases.length ? undefined : "No cases yet.",
      },
      {
        name: "Invoices",
        columns: [
          { label: "Invoice", value: (row: SpocInvoiceRow) => row.invoiceNumber },
          {
            label: "Status",
            value: (row: SpocInvoiceRow) => label(row.status),
            tone: (row: SpocInvoiceRow) => toneOf(row.status),
          },
          { label: "Issued", type: "date", value: (row: SpocInvoiceRow) => row.issuedAt },
          { label: "Due", type: "date", value: (row: SpocInvoiceRow) => row.dueAt },
          { label: "Total", type: "money", value: (row: SpocInvoiceRow) => row.totalAmount },
          { label: "Paid", type: "money", value: (row: SpocInvoiceRow) => row.paidAmount },
          { label: "Credited", type: "money", value: (row: SpocInvoiceRow) => row.creditedAmount },
          {
            label: "Balance",
            type: "money",
            value: (row: SpocInvoiceRow) => row.balance,
            tone: (row: SpocInvoiceRow) => (row.balance > 0 ? "warn" : "ok"),
          },
        ],
        rows: invoices,
        totals: ["Total", "Paid", "Credited", "Balance"],
        note: invoices.length ? undefined : "No invoices yet.",
      },
      {
        name: "Packages",
        columns: [
          { label: "Package", value: (row: Pkg) => row.name },
          { label: "List price", type: "money", value: (row: Pkg) => row.price },
          { label: "Discount %", type: "number", value: (row: Pkg) => row.discountPercent },
          {
            label: "Price after discount",
            type: "money",
            value: (row: Pkg) =>
              row.price === null ? null : row.price * (1 - row.discountPercent / 100),
          },
        ],
        rows: profile.packages.items,
        note: profile.packages.agreement
          ? "Only the packages in this company's agreement."
          : "No agreement: every active package at its list price.",
      },
      {
        name: "Client Admin logins",
        columns: [
          { label: "Name", value: (row: Login) => row.displayName },
          { label: "Email", value: (row: Login) => row.email },
          { label: "Phone", value: (row: Login) => row.phone },
          {
            label: "Status",
            value: (row: Login) => label(row.status),
            tone: (row: Login) => (row.status === "ACTIVE" ? "ok" : "danger"),
          },
          { label: "Last signed in", type: "datetime", value: (row: Login) => row.lastLoginAt },
          {
            label: "Must set password",
            value: (row: Login) => (row.mustChangePassword ? "Yes" : "No"),
          },
        ],
        rows: profile.users,
      },
    ],
  });
  return { cases: cases.length, invoices: invoices.length };
}

type Pkg = RmClientProfile["packages"]["items"][number];
type Login = RmClientProfile["users"][number];
