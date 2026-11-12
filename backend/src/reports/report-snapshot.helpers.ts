export function safeServiceDetails(json: string): Array<[string, string]> {
  const labels: Record<string, string> = {
    organisationName: "Organisation name",
    conflictOfInterest: "Declared conflict of interest",
    directorships: "Declared directorships",
    declaration: "Submitted declaration",
    referenceContacts: "Provided reference contacts",
    legalName: "Business legal name",
    companyName: "Company name",
    registrationNumber: "Registration number",
    gstin: "GSTIN",
    cin: "CIN",
    employerName: "Employer",
    institutionName: "Institution",
    declaredConflicts: "Declared conflicts",
    businessInterests: "Business interests",
    vendorCategory: "Vendor category",
  };
  try {
    const data: unknown = JSON.parse(json);
    if (!data || typeof data !== "object" || Array.isArray(data)) return [];
    return Object.entries(data).flatMap(([key, value]) =>
      labels[key] && typeof value === "string" && value.trim()
        ? [[labels[key], value.trim().slice(0, 2000)] as [string, string]]
        : [],
    );
  } catch {
    return [];
  }
}

export const documentLabel = (type: string) =>
  type.replaceAll("_", " ").toLowerCase();

export function qaDocumentNotes(
  review: { decision: string; checklistJson?: string | null } | undefined,
) {
  const notes = new Map<string, string[]>();
  if (review?.decision !== "APPROVED" || !review.checklistJson) return notes;
  let parsed: unknown;
  try {
    parsed = JSON.parse(review.checklistJson);
  } catch {
    return notes;
  }
  if (!Array.isArray(parsed)) return notes;
  for (const line of parsed) {
    if (typeof line !== "string") continue;
    const at = line.indexOf(": ");
    if (at < 1) continue;
    const key = line.slice(0, at).trim().toLowerCase();
    const comment = line.slice(at + 2).trim();
    if (comment) notes.set(key, [...(notes.get(key) ?? []), comment]);
  }
  return notes;
}

export function entriesOf(
  json: string | null | undefined,
): Array<Record<string, string>> {
  try {
    const parsed = JSON.parse(json ?? "") as { entries?: unknown };
    return Array.isArray(parsed.entries)
      ? parsed.entries.filter(
          (entry): entry is Record<string, string> =>
            Boolean(entry) &&
            typeof entry === "object" &&
            !Array.isArray(entry),
        )
      : [];
  } catch {
    return [];
  }
}
