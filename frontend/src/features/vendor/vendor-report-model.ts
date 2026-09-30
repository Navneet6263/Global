/** Mirrors the server rule for vendor reports; the server remains the authority. */
export const REPORT_MAX_BYTES = 2 * 1024 * 1024;
export const REPORT_ACCEPT = "application/pdf,image/png,.pdf,.png";
const TYPES = new Set(["application/pdf", "image/png"]);

export function reportFileProblem(file: { type: string; size: number }): string | null {
  if (!TYPES.has(file.type)) return "Only PDF or PNG reports are accepted.";
  if (file.size === 0) return "The selected file is empty.";
  if (file.size > REPORT_MAX_BYTES) return "The report must be 2 MB or smaller.";
  return null;
}

/** Local file name for a downloaded report, e.g. vendor-report-SG-1-v2.pdf. */
export function reportDownloadName(caseNumber: string, version: number, contentType: string) {
  const extension = contentType === "image/png" ? "png" : "pdf";
  return `vendor-report-${caseNumber.replace(/[^A-Za-z0-9-]/g, "_")}-v${version}.${extension}`;
}
