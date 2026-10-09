/**
 * Self sign-up onboarding checklist. Documents are stored as ClientAgreement rows (one per
 * type) with reviewed ClientAgreementFile revisions, so the existing independent review
 * and activation rules apply unchanged.
 */
export type OnboardingDocumentType =
  | "AGREEMENT"
  | "DPA"
  | "GST_CERTIFICATE"
  | "PAN"
  | "SIGNATORY_AUTHORITY"
  | "CONFIDENTIALITY"
  | "INCORPORATION"
  | "PURCHASE_ORDER";

export const ONBOARDING_DOCUMENTS: ReadonlyArray<{
  type: OnboardingDocumentType;
  label: string;
  hint: string;
  required: boolean;
  /** Signed contracts carry a signing date; KYC proofs use the upload date. */
  signed: boolean;
}> = [
  {
    type: "AGREEMENT",
    label: "Service agreement (MSA)",
    hint: "Signed and stamped by your authorised signatory.",
    required: true,
    signed: true,
  },
  {
    type: "DPA",
    label: "Data processing agreement (DPA)",
    hint: "Covers how candidate data is handled and protected.",
    required: true,
    signed: true,
  },
  {
    type: "GST_CERTIFICATE",
    label: "GST registration certificate",
    hint: "Must match the GSTIN entered in company details.",
    required: true,
    signed: false,
  },
  {
    type: "PAN",
    label: "Company PAN card",
    hint: "Must match the PAN entered in company details.",
    required: true,
    signed: false,
  },
  {
    type: "SIGNATORY_AUTHORITY",
    label: "Authorised signatory letter / board resolution",
    hint: "Confirms who may sign agreements for the company.",
    required: true,
    signed: false,
  },
  {
    type: "CONFIDENTIALITY",
    label: "NDA / confidentiality agreement",
    hint: "Optional, if your company requires one.",
    required: false,
    signed: true,
  },
  {
    type: "INCORPORATION",
    label: "Certificate of incorporation",
    hint: "Optional company registration proof.",
    required: false,
    signed: false,
  },
  {
    type: "PURCHASE_ORDER",
    label: "Purchase order",
    hint: "Optional, if your procurement issues one.",
    required: false,
    signed: false,
  },
];

export const ONBOARDING_DOCUMENT_TYPES = ONBOARDING_DOCUMENTS.map(
  (row) => row.type,
);
/** Approved before a self sign-up company is activated (AGREEMENT/DPA are always required). */
export const SELF_SIGNUP_KYC_TYPES: readonly string[] = [
  "GST_CERTIFICATE",
  "PAN",
  "SIGNATORY_AUTHORITY",
];

export type ChecklistCompany = {
  legalName: string;
  gstin: string | null;
  pan: string | null;
  billingAddress: string | null;
  billingTerms: string | null;
  primaryRmUserId: bigint | null;
  packageRates: Array<{ active: boolean }>;
  agreements: Array<{
    type: string;
    files: Array<{ status: string }>;
  }>;
};

export type DocumentState = "MISSING" | "PENDING" | "APPROVED" | "REJECTED";

export function documentState(
  company: Pick<ChecklistCompany, "agreements">,
  type: string,
): DocumentState {
  const latest = company.agreements.find((row) => row.type === type)?.files[0];
  if (!latest) return "MISSING";
  if (latest.status === "APPROVED") return "APPROVED";
  if (latest.status === "REJECTED") return "REJECTED";
  return "PENDING";
}

/**
 * Steps the company and Operations complete. `clientDone` gates "Submit for review";
 * `done` drives the progress bar for both sides.
 */
export function checklistProgress(company: ChecklistCompany) {
  const detailsDone = Boolean(
    company.legalName.trim() &&
    company.gstin &&
    company.pan &&
    company.billingAddress?.trim(),
  );
  const required = ONBOARDING_DOCUMENTS.filter((row) => row.required);
  const states = required.map((row) => documentState(company, row.type));
  const uploaded = states.filter(
    (state) => state === "PENDING" || state === "APPROVED",
  ).length;
  const approved = states.filter((state) => state === "APPROVED").length;
  const commercialDone = Boolean(
    company.billingTerms?.trim() &&
    company.packageRates.some((rate) => rate.active),
  );
  const missing: string[] = [];
  if (!detailsDone)
    missing.push("company details (legal name, GSTIN, PAN, billing address)");
  required.forEach((row, index) => {
    if (states[index] === "MISSING") missing.push(row.label);
    if (states[index] === "REJECTED") missing.push(`${row.label} (re-upload)`);
  });
  // Details 1 + each required document uploaded + approved + commercial + RM.
  const total = 1 + required.length * 2 + 2;
  const done =
    (detailsDone ? 1 : 0) +
    uploaded +
    approved +
    (commercialDone ? 1 : 0) +
    (company.primaryRmUserId ? 1 : 0);
  return {
    detailsDone,
    documentsUploaded: uploaded,
    documentsApproved: approved,
    documentsRequired: required.length,
    commercialDone,
    rmAssigned: Boolean(company.primaryRmUserId),
    clientDone: missing.length === 0,
    missing,
    done,
    total,
    percent: Math.round((done / total) * 100),
  };
}
