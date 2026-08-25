export type OpportunityDraft = {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  estimatedValue: string;
  probability: number;
  expectedCloseDate: string;
  source: string;
  notes: string;
};

export const emptyOpportunityDraft: OpportunityDraft = {
  companyName: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  estimatedValue: "",
  probability: 25,
  expectedCloseDate: "",
  source: "",
  notes: "",
};

export function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: value >= 10_000_000 ? "compact" : "standard",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

export function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
