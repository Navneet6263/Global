import { Injectable, NotFoundException, StreamableFile } from "@nestjs/common";
import type { Actor } from "../../common/auth/actor";
import { spocScope } from "../../common/auth/access-scope";
import { LocalObjectStorageService } from "../../documents/local-object-storage.service";
import type { Prisma } from "../../generated/prisma/client";
import { VendorReportsRepository } from "../vendor-reports.repository";
import { reportFileName } from "./vendor-report-rules";
import { ownRequests } from "./vendor-scope";

export type ReportMode = "preview" | "download";

/**
 * Streams the latest report of an APPROVED request, inline for preview or as an
 * attachment for download, after writing the audit row. The vendor side is limited
 * to its own requests; SPOC-RM to its assigned clients.
 */
@Injectable()
export class VendorReportFileService {
  constructor(
    private readonly repository: VendorReportsRepository,
    private readonly storage: LocalObjectStorageService,
  ) {}

  forVendor(actor: Actor, requestPublicId: string, mode: ReportMode) {
    return this.stream(
      actor,
      { ...ownRequests(actor), publicId: requestPublicId },
      mode,
    );
  }

  forSpoc(actor: Actor, assignmentPublicId: string, mode: ReportMode) {
    return this.stream(
      actor,
      {
        tenantId: actor.tenantId,
        publicId: assignmentPublicId,
        case: spocScope(actor),
      },
      mode,
    );
  }

  private async stream(
    actor: Actor,
    where: Prisma.VendorAssignmentWhereInput,
    mode: ReportMode,
  ) {
    const row = await this.repository.findReportFile(where);
    const report = row?.reports[0];
    if (!row || !report) throw new NotFoundException("Report not found");
    const contents = await this.storage.auditedStream(report.objectKey, () =>
      this.repository.audit({
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        // Only a real download counts as SPOC-RM receiving the report.
        action:
          mode === "download"
            ? "vendor_assignment.report-downloaded"
            : "vendor_assignment.report-previewed",
        resourceType: "vendor_assignment",
        resourcePublicId: row.publicId,
        afterJson: JSON.stringify({
          reportId: report.publicId,
          version: report.version,
        }),
      }),
    );
    const filename = reportFileName(
      row.case.caseNumber,
      report.version,
      report.contentType,
    );
    return new StreamableFile(contents, {
      type: report.contentType,
      disposition: `${mode === "preview" ? "inline" : "attachment"}; filename="${filename}"`,
    });
  }
}
