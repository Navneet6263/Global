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
