import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../../common/auth/actor";
import { VendorRequestsRepository } from "../vendor-requests.repository";
import type { VendorDecisionDto } from "../vendor-requests.validation";
import { ownRequests } from "./vendor-scope";
import { notifySpocOfDecision } from "./vendor-notify";
import { decisionFields } from "./vendor-rules";

/**
 * A vendor approves or rejects its own PENDING request (a rejection needs a reason).
 * Version-checked, audited, and the client's SPOC side is notified.
 */
@Injectable()
export class DecideVendorRequestService {
  constructor(private readonly repository: VendorRequestsRepository) {}

  async decide(
    actor: Actor,
    requestPublicId: string,
    input: VendorDecisionDto,
  ) {
    const fields = decisionFields(input.decision, input.reason);
    return this.repository.transaction(async (tx) => {
      const row = await this.repository.findOwnForDecision(tx, {
        ...ownRequests(actor),
        publicId: requestPublicId,
      });
      if (!row) throw new NotFoundException("Request not found");
      if (row.status !== "PENDING")
        throw new ConflictException("This request has already been decided");
      if (row.version !== input.version)
        throw new ConflictException("Request changed; refresh and try again");
      const decidedAt = new Date();
      const updated = await this.repository.recordDecision(
        tx,
        {
          id: row.id,
          ...ownRequests(actor),
          status: "PENDING",
          version: input.version,
        },
        { ...fields, decidedById: actor.userId, decidedAt },
      );
      if (updated.count !== 1)
        throw new ConflictException(
          "Request was decided at the same time; refresh",
        );
      await this.repository.recordAudit(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: `vendor_assignment.${input.decision.toLowerCase()}`,
        resourceType: "vendor_assignment",
        resourcePublicId: row.publicId,
        beforeJson: JSON.stringify({ status: "PENDING", version: row.version }),
        afterJson: JSON.stringify({
          documentId: row.document.publicId,
          documentVersion: row.documentVersion,
          caseId: row.case.publicId,
          caseNumber: row.case.caseNumber,
          attempt: row.attempt,
          status: fields.status,
          reason: fields.decisionReason,
          decidedAt,
        }),
      });
      await notifySpocOfDecision(tx, {
        tenantId: actor.tenantId,
        caseNumber: row.case.caseNumber,
        documentType: row.document.type,
        clientName: row.client.displayName,
        clientId: row.clientId,
        assignedById: row.assignedById,
        // A team user decides on behalf of its Main Vendor; SPOC-RM sees both names.
        vendorName:
          actor.vendorOwnerId !== undefined
            ? `${actor.displayName} (${row.vendor.displayName})`
            : actor.displayName,
        decision: input.decision,
        reason: fields.decisionReason,
      });
      return {
        id: row.publicId,
        status: fields.status,
        version: row.version + 1,
        decidedAt,
        reason: fields.decisionReason,
      };
    });
  }
}
