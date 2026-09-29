import { Injectable, NotFoundException } from "@nestjs/common";
import type { Actor } from "../../common/auth/actor";
import { supportScope } from "../../common/auth/access-scope";
import { documentVendorStatus } from "../../vendor-requests/services/vendor-rules";
import { SupportDirectoryRepository } from "../support-directory.repository";
import { SupportRepository } from "../support.repository";
import { toEmployee } from "./support-employee-view";
import { toSupportRequest } from "./support-request-view";
import { OPEN_CLARIFICATION_STATUSES } from "./support-rules";

/**
 * One employee's journey for the support desk: stage history, checks and blockers,
 * documents with review and vendor status, pending items and linked requests.
 * Status metadata only: no contact details, files, findings or money.
 */
@Injectable()
export class SupportEmployeeDetailService {
  constructor(
    private readonly directory: SupportDirectoryRepository,
    private readonly requests: SupportRepository,
  ) {}

  async detail(actor: Actor, casePublicId: string) {
    const now = new Date();
    const row = await this.directory.findEmployee({
      ...supportScope(actor),
      publicId: casePublicId,
    });
    if (!row) throw new NotFoundException("Employee case not found");
    const [pendingItems, requests] = await Promise.all([
      this.directory.pendingItems(row.id),
      this.requests.forCase(actor.tenantId, row.id),
    ]);
    const openClarifications = row.clarifications.filter((item) =>
      OPEN_CLARIFICATION_STATUSES.includes(item.status),
    );
    return {
      ...toEmployee({ ...row, clarifications: openClarifications }, now),
      pendingItems,
      history: row.statusHistory,
      checkList: row.checks.map((check) => ({
        type: check.type,
        status: check.status,
        completedAt: check.completedAt,
        tasks: check.tasks.map((task) => ({
          status: task.status,
          dueAt: task.dueAt,
          assignee: task.assignee?.displayName ?? null,
          blockerReason: task.status === "BLOCKED" ? task.blockerReason : null,
        })),
      })),
      documentList: row.documents.map((document) => ({
        id: document.publicId,
        type: document.type,
        status: document.status,
        currentVersion: document.currentVersion,
        reviewNote: document.reviewNote,
        uploadedAt: document.versions[0]?.createdAt ?? null,
        updatedAt: document.updatedAt,
        vendorStatus: documentVendorStatus(document.vendorAssignments),
      })),
      clarifications: row.clarifications,
      consentStatus: row.consents[0]?.status ?? "NOT_REQUESTED",
      reportPublished: row.reports.some(
        (report) => report.status === "PUBLISHED",
      ),
      supportRequests: requests.map((request) =>
        toSupportRequest(request, actor.userId),
      ),
    };
  }
}
