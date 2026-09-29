import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../../common/auth/actor";
import { spocScope } from "../../common/auth/access-scope";
import { VendorAssignmentsRepository } from "../vendor-assignments.repository";
import type { ReassignVendorDto } from "../vendor-requests.validation";
import { toAssignmentResult } from "./vendor-request-view";
import { notifyVendorAssigned } from "./vendor-notify";
import {
  REUPLOAD_REQUIRED,
  latestAttempt,
  nextVendorAction,
  onAssignmentRace,
  requiredText,
} from "./vendor-rules";

/**
 * SPOC-RM "Re-assign" after a rejection: adds attempt n+1 pinned to the latest clean
 * version and never edits the rejected row. Waits while a re-upload is awaited.
 */
@Injectable()
export class ReassignVendorService {
  constructor(private readonly repository: VendorAssignmentsRepository) {}

  async reassign(
    actor: Actor,
    assignmentPublicId: string,
    input: ReassignVendorDto,
  ) {
    const resolutionNote = requiredText(
      input.resolutionNote,
      "Resolution note",
    );
    return onAssignmentRace(() =>
      this.repository.serializable(async (tx) => {
        const previous = await this.repository.findAssignmentToReassign(tx, {
          tenantId: actor.tenantId,
          publicId: assignmentPublicId,
          case: spocScope(actor),
        });
        if (!previous)
          throw new NotFoundException("Vendor assignment not found");
        if (previous.version !== input.version)
          throw new ConflictException(
            "Assignment changed; refresh and try again",
          );
        const { document } = previous;
        const version = document.versions[0]?.version;
        const next = nextVendorAction(
          document.vendorAssignments,
          previous.case.status,
          version !== undefined,
          document.status,
        );
        const latest = latestAttempt(document.vendorAssignments);
        if (document.status === REUPLOAD_REQUIRED)
          throw new ConflictException(
            "Waiting for the candidate's re-upload; re-assign once the new version arrives",
          );
        if (
          !next.canReassign ||
          version === undefined ||
          latest?.attempt !== previous.attempt
        )
          throw new ConflictException(
            "Only the latest rejected assignment of an open case can be re-assigned",
          );
        const vendor = await this.repository.findActiveVendor(
          tx,
          actor.tenantId,
          input.vendorId,
        );
        if (!vendor) throw new NotFoundException("Active vendor not found");
        const attempt = previous.attempt + 1;
        const row = await this.repository.createAssignment(tx, {
          tenantId: actor.tenantId,
          clientId: previous.case.clientId,
          caseId: previous.case.id,
          documentId: document.id,
          documentVersion: version,
          attempt,
          vendorUserId: vendor.id,
          assignedById: actor.userId,
          resolutionNote,
        });
        await this.repository.recordAudit(tx, {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "vendor_assignment.reassigned",
          resourceType: "vendor_assignment",
          resourcePublicId: row.publicId,
          beforeJson: JSON.stringify({
            assignmentId: previous.publicId,
            attempt: previous.attempt,
            status: previous.status,
            vendorId: previous.vendor.publicId,
            vendorName: previous.vendor.displayName,
            rejectionReason: previous.decisionReason,
          }),
          afterJson: JSON.stringify({
            documentId: document.publicId,
            documentType: document.type,
            documentVersion: version,
            caseId: previous.case.publicId,
            caseNumber: previous.case.caseNumber,
            attempt,
            vendorId: vendor.publicId,
            vendorName: vendor.displayName,
            status: "PENDING",
            resolutionNote,
          }),
        });
        await notifyVendorAssigned(
          tx,
          {
            tenantId: actor.tenantId,
            caseNumber: previous.case.caseNumber,
            documentType: document.type,
            clientName: previous.case.client.displayName,
          },
          vendor.id,
          true,
        );
        return toAssignmentResult(row, vendor);
      }),
    );
  }
}
