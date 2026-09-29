import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../../common/auth/actor";
import { spocScope } from "../../common/auth/access-scope";
import { VendorAssignmentsRepository } from "../vendor-assignments.repository";
import type { AssignVendorDto } from "../vendor-requests.validation";
import { toAssignmentResult } from "./vendor-request-view";
import { notifyVendorAssigned } from "./vendor-notify";
import {
  nextVendorAction,
  onAssignmentRace,
  optionalText,
} from "./vendor-rules";

/** SPOC-RM "Assign to vendor": starts a document's chain with attempt 1. */
@Injectable()
export class AssignVendorService {
  constructor(private readonly repository: VendorAssignmentsRepository) {}

  async assign(actor: Actor, documentPublicId: string, input: AssignVendorDto) {
    const note = optionalText(input.note);
    return onAssignmentRace(() =>
      this.repository.serializable(async (tx) => {
        const document = await this.repository.findDocumentToAssign(tx, {
          tenantId: actor.tenantId,
          publicId: documentPublicId,
          case: spocScope(actor),
        });
        if (!document) throw new NotFoundException("Document not found");
        const version = document.versions[0]?.version;
        const next = nextVendorAction(
          document.vendorAssignments,
          document.case.status,
          version !== undefined,
        );
        if (!next.canAssign || version === undefined)
          throw new ConflictException(
            document.vendorAssignments.length
              ? "This document already has a vendor assignment"
              : "Only a safely uploaded document in an open case can be assigned",
          );
        const vendor = await this.repository.findActiveVendor(
          tx,
          actor.tenantId,
          input.vendorId,
        );
        if (!vendor) throw new NotFoundException("Active vendor not found");
        const row = await this.repository.createAssignment(tx, {
          tenantId: actor.tenantId,
          clientId: document.case.clientId,
          caseId: document.case.id,
          documentId: document.id,
          documentVersion: version,
          attempt: 1,
          vendorUserId: vendor.id,
          assignedById: actor.userId,
          assignmentNote: note,
        });
        await this.repository.recordAudit(tx, {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "vendor_assignment.assigned",
          resourceType: "vendor_assignment",
          resourcePublicId: row.publicId,
          afterJson: JSON.stringify({
            documentId: document.publicId,
            documentType: document.type,
            documentVersion: version,
            caseId: document.case.publicId,
            caseNumber: document.case.caseNumber,
            attempt: 1,
            vendorId: vendor.publicId,
            vendorName: vendor.displayName,
            status: "PENDING",
            note,
          }),
        });
        await notifyVendorAssigned(
          tx,
          {
            tenantId: actor.tenantId,
            caseNumber: document.case.caseNumber,
            documentType: document.type,
            clientName: document.case.client.displayName,
          },
          vendor.id,
          false,
        );
        return toAssignmentResult(row, vendor);
      }),
    );
  }
}
