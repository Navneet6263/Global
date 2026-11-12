export type CaseRow = Record<string, unknown>;

export function objectRow(value: unknown): CaseRow {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as CaseRow)
    : {};
}

export function rowList(value: unknown): CaseRow[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is CaseRow =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

/**
 * Where the case stands for the client while it waits on documents, in the client's words:
 * the internal intake stage, Data Entry and RM never show. Null once verification runs.
 */
export function clientProgress(row: CaseRow) {
  const submitted = rowList(row.candidateAccess)[0]?.completedAt ?? null;
  const stage = typeof row.intakeStage === "string" ? row.intakeStage : null;
  const progress = (key: string, label: string, detail: string) => ({
    stage: key,
    label,
    detail,
    candidateSubmittedAt: submitted,
  });
  if (row.status !== "CONSENT_PENDING" && row.status !== "DOCUMENT_PENDING")
    return { stage: null, label: null, detail: null, candidateSubmittedAt: submitted };
  if (stage === "CLIENT_REVIEW")
    return progress(
      "YOUR_REVIEW",
      "Waiting for your review",
      "The candidate uploaded every document. Review them and approve to start verification.",
    );
  if (stage === "CLIENT_RETURNED" || stage === "CORRECTION")
    return progress(
      "CORRECTION",
      "Correction requested",
      "A document or detail needs correcting. Verification continues once it is in.",
    );
  if (submitted || ["DATA_ENTRY", "READY", "ROUTED"].includes(stage ?? ""))
    return progress(
      "DOCUMENTS_RECEIVED",
      "Documents received",
      "The candidate uploaded every document. Our team is checking them; verification starts next.",
    );
  return progress(
    "WAITING_CANDIDATE",
    row.status === "CONSENT_PENDING"
      ? "Waiting for the candidate's consent"
      : "Waiting for the candidate's documents",
    "The candidate has a secure link to give consent and upload the documents.",
  );
}

/** Pins the client view to `currentVersion` and strips internal review state. */
export function clientDocument(document: CaseRow) {
  const safe = { ...document };
  const cleanVersions = rowList(document.versions).filter(
    (version) => version.malwareState === "CLEAN",
  );
  const currentVersion =
    typeof document.currentVersion === "number" ? document.currentVersion : null;
  const latest =
    (currentVersion && currentVersion > 0
      ? cleanVersions.find((version) => version.version === currentVersion)
      : undefined) ?? cleanVersions[0];
  return {
    ...safe,
    versions: latest
      ? [
          {
            version: latest.version,
            originalName: latest.originalName,
            contentType: latest.contentType,
            sizeBytes: Number(latest.sizeBytes),
            createdAt: latest.createdAt,
          },
        ]
      : [],
  };
}

export function clientClarification(row: CaseRow) {
  return {
    publicId: row.publicId,
    level: row.level ?? "L1",
    status: row.status,
    subject: row.subject,
    requestedDocumentType: row.requestedDocumentType ?? null,
    submittedDocumentVersion: row.submittedDocumentVersion ?? null,
    rejectionCount: row.rejectionCount ?? 0,
    lastRejectedAt: row.lastRejectedAt ?? null,
    lastRejectedReason: row.lastRejectedReason ?? null,
    dueAt: row.dueAt,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
  };
}

export function clientEscalation(row: CaseRow) {
  const note = typeof row.escalationNote === "string" ? row.escalationNote : "";
  if (!row.escalatedAt || !note.startsWith("Client: ")) return null;
  return { at: row.escalatedAt, reason: note.slice("Client: ".length) };
}
