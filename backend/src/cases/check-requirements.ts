import { INITIATION_FORMS } from "../workflow/initiation-fields";

/** The document a candidate uploads for each check that needs one. */
export const CHECK_DOCUMENTS: Readonly<Record<string, string>> = {
  IDENTITY: "AADHAAR",
  ADDRESS: "ADDRESS_PROOF",
  EMPLOYMENT: "EMPLOYMENT_PROOF",
  EDUCATION: "EDUCATION_CERTIFICATE",
  PAN_VALIDATION: "PAN",
};

/** Which checks use a document. A document not listed here is general (OTHER). */
const DOCUMENT_CHECKS: Readonly<Record<string, readonly string[]>> = {
  AADHAAR: ["IDENTITY"],
  PASSPORT: ["IDENTITY"],
  DRIVING_LICENCE: ["IDENTITY"],
  PAN: ["IDENTITY", "PAN_VALIDATION"],
  ADDRESS_PROOF: ["ADDRESS"],
  EMPLOYMENT_PROOF: ["EMPLOYMENT"],
  EDUCATION_CERTIFICATE: ["EDUCATION"],
};

/**
 * A package lists documents for all its checks; a case may order only some of them.
 * Keep what the ordered checks use, plus general documents, so nobody is asked for a
 * document no ordered check needs. Unreadable lists are returned as they are, so the
 * existing "policy is invalid" error still reaches an administrator.
 */
export function requiredDocumentsForChecks(
  requiredDocumentsJson: string,
  checks: readonly string[],
): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(requiredDocumentsJson);
  } catch {
    return requiredDocumentsJson;
  }
  if (!Array.isArray(parsed)) return requiredDocumentsJson;
  return JSON.stringify(
    parsed.filter((type) => {
      const uses = typeof type === "string" ? DOCUMENT_CHECKS[type] : undefined;
      return !uses || uses.some((check) => checks.includes(check));
    }),
  );
}

/** The ordered checks a document is for, so people can see why it is asked for. */
export function checksForDocument(
  type: string,
  checks: readonly string[],
): string[] {
  const uses = DOCUMENT_CHECKS[type] ?? [];
  return [...new Set(checks)].filter((check) => uses.includes(check));
}

/** Check-wise list shown before a case starts: documents, and required details. */
export function checkRequirements(checks: readonly string[]) {
  return [...new Set(checks)].map((type) => {
    const document = CHECK_DOCUMENTS[type];
    return {
      type,
      documents: document ? [document] : [],
      details: (INITIATION_FORMS[type]?.fields ?? [])
        .filter((field) => field.required)
        .map((field) => field.label),
    };
  });
}

/** Every document this case asks for, each with the ordered checks it is for. */
export function caseDocumentRequirements(
  requiredDocuments: readonly string[],
  checks: readonly string[],
) {
  const types = new Set(requiredDocuments);
  for (const check of checks) {
    const document = CHECK_DOCUMENTS[check];
    if (document) types.add(document);
  }
  return [...types].map((type) => ({
    type,
    checks: checksForDocument(type, checks),
  }));
}
