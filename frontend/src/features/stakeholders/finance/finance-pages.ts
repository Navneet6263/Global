export type FinanceView =
  "overview" | "invoices" | "billing" | "collections" | "credit" | "statements";
export const financePages: Record<FinanceView, [string, string]> = {
  overview: [
    "Finance overview",
    "Track billing, collections and the balances that need attention.",
  ],
  invoices: ["Invoices", "Find an invoice, review its ledger and record payments or credit notes."],
  billing: [
    "Ready for billing",
    "Turn approved report charges into invoices using the agreed case prices.",
  ],
  collections: [
    "Collections",
    "Overdue invoices are shown first. Open an invoice to inspect its balance and record a payment.",
  ],
  credit: [
    "Credit control",
    "Review client balances, set limits and manage explicit new-case holds.",
  ],
  statements: [
    "Client statements",
    "Download monthly invoice, payment and credit-note activity for a client.",
  ],
};
