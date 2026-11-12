export function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

const NEEDS_UPLOAD = new Set(["REUPLOAD_REQUIRED", "REJECTED"]);

/** Documents the candidate must upload again, using the existing document states. */
export function documentsToReupload<T extends { status: string }>(documents: readonly T[]): T[] {
  return documents.filter((document) => NEEDS_UPLOAD.has(document.status));
}

export const DOCS: Record<string, { label: string; hint: string; expiry?: boolean }> = {
  AADHAAR: { label: "Aadhaar card", hint: "Front and back in one PDF, or a clear photo." },
  PAN: { label: "PAN card", hint: "A clear photo or scan of your PAN card." },
  PASSPORT: { label: "Passport", hint: "First and last page.", expiry: true },
  DRIVING_LICENCE: { label: "Driving licence", hint: "Front and back.", expiry: true },
  ADDRESS_PROOF: {
    label: "Address proof",
    hint: "Utility bill, rent agreement or bank statement from the last 3 months.",
  },
  EDUCATION_CERTIFICATE: {
    label: "Education certificate",
    hint: "The certificate or final marksheet of each qualification asked for, in one PDF.",
  },
  EMPLOYMENT_PROOF: {
    label: "Employment proof",
    hint: "Relieving or experience letter of each employer asked for, in one PDF.",
  },
  BANK_PROOF: {
    label: "Bank proof",
    hint: "A cancelled cheque or a recent bank statement showing the account number and IFSC.",
  },
  OTHER: { label: "Other requested document", hint: "The document the team asked you for." },
};

export const docMeta = (type: string) =>
  DOCS[type] ?? { label: type.replaceAll("_", " ").toLowerCase(), hint: "" };

export function validateCandidateFile(file: File) {
  if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type))
    return "Only PDF, JPG or PNG files are accepted.";
  if (file.size === 0) return "The selected file is empty.";
  if (file.size > 10 * 1024 * 1024) return "The file is larger than 10 MB.";
  return "";
}

export function l2StageNote(status: string) {
  switch (status) {
    case "CANDIDATE_SUBMITTED":
      return "Submitted — our Operations team is reviewing your document before forwarding to Data Entry.";
    case "DATA_ENTRY_PENDING":
      return "Reviewed by Operations — our Data Entry team is updating your verification details.";
    case "RESOLVED":
      return "Completed — your corrected document and details have been updated.";
    default:
      return null;
  }
}
