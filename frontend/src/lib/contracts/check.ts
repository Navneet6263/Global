export const CHECK_LABELS = {
  identity: "Identity",
  address: "Address",
  employment: "Employment",
  education: "Education",
  criminal: "Criminal",
  court_record: "Court record",
  reference: "Reference",
  global_database: "Global database",
  drug_test: "Drug test",
  resume_consistency: "Resume consistency",
  conflict_of_interest: "Conflict of interest",
  anti_bribery: "Anti-bribery",
  misconduct: "Misconduct",
  adverse_media: "Adverse media",
  directorship: "Directorship",
  business_interest: "Business interest",
  sanctions: "Sanctions",
  company_registration: "Company registration",
  gst_validation: "GST validation",
  pan_validation: "PAN validation",
  mca_validation: "MCA validation",
  other: "Other",
} as const;

export type CheckType = keyof typeof CHECK_LABELS;

export function normalizeCheckType(value: string): CheckType {
  const key = value.toLowerCase();
  return Object.hasOwn(CHECK_LABELS, key) ? (key as CheckType) : "other";
}

export function checkLabel(value: string): string {
  const key = normalizeCheckType(value);
  return key === "other" ? value.replaceAll("_", " ") : CHECK_LABELS[key];
}
