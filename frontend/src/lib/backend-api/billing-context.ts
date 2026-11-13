import { apiRequest } from "./client";

/** What Finance sees beside the invoice form once a company is chosen. */
export interface BillingContext {
  client: {
    id: string;
    name: string;
    legalName: string;
    gstin: string | null;
    state: string;
    tax: "CGST_SGST" | "IGST";
    creditLimit: number | null;
    creditHold: boolean;
  };
  account: {
    invoices: number;
    billed: number;
    paid: number;
    outstanding: number;
    overdue: number;
    overdueInvoices: number;
    last: {
      invoiceNumber: string;
      issuedAt: string | null;
      dueAt: string | null;
      total: number;
      status: string;
    } | null;
  };
  monthlyBills: Array<{
    invoiceNumber: string;
    validation: "PENDING" | "VALIDATED" | "QUERIED" | null;
    total: number;
    lines: number;
  }>;
  unbilled: Array<{
    reportId: string;
    caseId: string;
    caseNumber: string;
    candidateName: string;
    releasedAt: string;
    lines: Array<{ description: string; unitPrice: number; taxRate: number }>;
  }>;
  unbilledTaxable: number;
}

export const getBillingContext = (clientId: string) =>
  apiRequest<BillingContext>(`/finance/clients/${clientId}/billing-context`);
