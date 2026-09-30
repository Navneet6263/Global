import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type { Actor } from "../../common/auth/actor";
import type { UploadedBinary } from "../../common/http/uploaded-binary";
import { ContentInspectionService } from "../../documents/content-inspection.service";
import { LocalObjectStorageService } from "../../documents/local-object-storage.service";
import { VendorReportsRepository } from "../vendor-reports.repository";
import { notifyReportAvailable } from "./vendor-notify";
import {
  REPORT_MAX_BYTES,
  REPORT_MAX_VERSIONS,
  assertReportFile,
  assertReportableStatus,
} from "./vendor-report-rules";
import { ownRequests } from "./vendor-scope";
import { toReportView } from "./vendor-request-view";

/**
 * A Main Vendor, or the team user the request is delegated to, attaches a report to
 * an APPROVED request. The file is inspected like every other upload (type, magic
 * bytes, malware), stored, versioned, audited, and SPOC-RM is told it is available.
 */
@Injectable()
export class UploadVendorReportService {
  private readonly logger = new Logger(UploadVendorReportService.name);

  constructor(
    private readonly repository: VendorReportsRepository,
    private readonly inspection: ContentInspectionService,
    private readonly storage: LocalObjectStorageService,
  ) {}

  async upload(actor: Actor, requestPublicId: string, upload: UploadedBinary) {
    const file = assertReportFile(upload);
    const request = await this.repository.findForUpload({
      ...ownRequests(actor),
      publicId: requestPublicId,
    });
    if (!request) throw new NotFoundException("Request not found");
    assertReportableStatus(request.status);
    await this.inspection.inspect(file, REPORT_MAX_BYTES, {
      documentType: "OTHER",
    });
    const sha256 = createHash("sha256").update(file.buffer).digest("hex");
    const objectKey = `${actor.tenantPublicId}/vendor-reports/${request.publicId}/${randomUUID()}`;
    await this.storage.put(objectKey, file.buffer);
    try {
      return await this.repository.transaction(async (tx) => {
        const locked = await this.repository.lockApproved(tx, request.id);
        if (locked.count !== 1)
          throw new ConflictException("Request changed; refresh and try again");
        const latest = await this.repository.latestVersion(tx, request.id);
        if (latest?.sha256 === sha256)
          throw new ConflictException(
            "This exact report is already the latest version",
          );
        if ((latest?.version ?? 0) >= REPORT_MAX_VERSIONS)
          throw new ConflictException(
            `A request keeps at most ${REPORT_MAX_VERSIONS} report versions`,
          );
        const report = await this.repository.create(tx, {
          tenantId: actor.tenantId,
          assignmentId: request.id,
          version: (latest?.version ?? 0) + 1,
          objectKey,
          originalName: file.originalName.slice(0, 255),
          contentType: file.mimetype,
          sizeBytes: file.size,
          sha256,
          uploadedById: actor.userId,
        });
        await this.repository.recordAudit(tx, {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "vendor_assignment.report-uploaded",
          resourceType: "vendor_assignment",
          resourcePublicId: request.publicId,
          afterJson: JSON.stringify({
            reportId: report.publicId,
            version: report.version,
            contentType: file.mimetype,
            sizeBytes: file.size,
            sha256,
          }),
        });
        await notifyReportAvailable(tx, {
          tenantId: actor.tenantId,
          clientId: request.clientId,
          clientPublicId: request.client.publicId,
          assignedById: request.assignedById,
          caseNumber: request.case.caseNumber,
          documentType: request.document.type,
          clientName: request.client.displayName,
          vendorName: request.vendor.displayName,
          version: report.version,
        });
        return toReportView(report);
      });
    } catch (error) {
      await this.discard(actor.tenantId, request.publicId, objectKey);
      throw error;
    }
  }

  /** A timeout can leave an uncertain commit: only an unreferenced object is removed. */
  private async discard(
    tenantId: bigint,
    assignmentPublicId: string,
    objectKey: string,
  ) {
    const referenced = await this.repository
      .isReferenced(objectKey)
      .catch(() => 1);
    if (referenced) return;
    try {
      await this.storage.delete(objectKey);
    } catch {
      try {
        await this.repository.queueObjectDelete(
          tenantId,
          assignmentPublicId,
          objectKey,
        );
      } catch {
        this.logger.error(
          `Uncommitted vendor report object needs cleanup: ${objectKey}`,
        );
      }
    }
  }
}
