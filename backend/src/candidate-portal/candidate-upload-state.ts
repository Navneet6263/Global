import { caseDocumentTypes } from "../cases/check-requirements";

type CandidateDocument = {
  type: string;
  status: string;
  currentVersion: number;
  reviewNote: string | null;
};

export type CandidateItemState =
  "NEEDED" | "UPLOADED" | "VERIFIED" | "REUPLOAD";

/**
 * What the candidate must upload: every document the case asks for, plus any document
 * the team sent back. Documents are ordered newest first, so the first match is current.
 */
export function candidateUploadItems(
  requiredTypes: string[],
  documents: CandidateDocument[],
) {
  const latest = new Map<string, CandidateDocument>();
  for (const document of documents)
    if (!latest.has(document.type)) latest.set(document.type, document);
  const sentBack = [...latest.values()]
    .filter((document) =>
      ["REJECTED", "REUPLOAD_REQUIRED"].includes(document.status),
    )
    .map((document) => document.type);
  const types = [...new Set([...requiredTypes, ...sentBack])];
  const items = types.map((type) => {
    const document = latest.get(type);
    const state: CandidateItemState =
      !document || document.currentVersion < 1
        ? "NEEDED"
        : ["REJECTED", "REUPLOAD_REQUIRED"].includes(document.status)
          ? "REUPLOAD"
          : document.status === "VERIFIED"
            ? "VERIFIED"
            : "UPLOADED";
    return {
      type,
      required: requiredTypes.includes(type),
      state,
      reviewNote: state === "REUPLOAD" ? (document?.reviewNote ?? null) : null,
      version: document?.currentVersion ?? 0,
    };
  });
  return {
    items,
    complete: items.every(
      (item) => item.state === "UPLOADED" || item.state === "VERIFIED",
    ),
  };
}

/**
 * Everything the candidate is asked for: the package's required documents, plus the
 * document each ordered check needs — so a package saved without a document list still
 * asks the candidate for the right proofs.
 */
export function candidateRequestedTypes(
  requiredTypes: readonly string[],
  checks: ReadonlyArray<{ type: string }>,
) {
  return caseDocumentTypes(
    requiredTypes,
    checks.map((check) => check.type.toUpperCase()),
  );
}
