import { BadRequestException, ConflictException } from "@nestjs/common";
import type { UploadedBinary } from "../../common/http/uploaded-binary";

/** A vendor report: PDF or PNG only, at most 2 MB, attached after approval. */
export const REPORT_MAX_BYTES = 2 * 1024 * 1024;
export const REPORT_CONTENT_TYPES: readonly string[] = [
  "application/pdf",
  "image/png",
];
/** Replacements add versions; this caps the history kept per request. */
export const REPORT_MAX_VERSIONS = 10;

/** Type and size are refused here before any storage; magic bytes are inspected next. */
export function assertReportFile(
  file: UploadedBinary | undefined,
): UploadedBinary {
  if (!file?.buffer?.length)
    throw new BadRequestException("A report file is required");
  if (!REPORT_CONTENT_TYPES.includes(file.mimetype))
    throw new BadRequestException("The report must be a PDF or PNG file");
  if (file.size > REPORT_MAX_BYTES || file.buffer.length > REPORT_MAX_BYTES)
    throw new BadRequestException("The report must be 2 MB or smaller");
  return file;
}

/** Reports belong to approved requests only (you approve first, then upload). */
export function assertReportableStatus(status: string): void {
  if (status === "APPROVED") return;
  throw new ConflictException(
    status === "REJECTED"
      ? "Reports are only for approved requests"
      : "Approve the request before uploading its report",
  );
}

/** A safe download name that never echoes the uploaded file name into headers. */
export function reportFileName(
  caseNumber: string,
  version: number,
  contentType: string,
) {
  const extension = contentType === "image/png" ? "png" : "pdf";
  return `vendor-report-${caseNumber.replace(/[^A-Za-z0-9-]/g, "_")}-v${version}.${extension}`;
}
