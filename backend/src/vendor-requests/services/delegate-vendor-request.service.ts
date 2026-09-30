import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../../common/auth/actor";
import { VendorRequestsRepository } from "../vendor-requests.repository";
import type { VendorTx } from "../vendor-assignments.repository";
import type { DelegateVendorRequestDto } from "../vendor-requests.validation";
import { VendorTeamRepository } from "../vendor-team.repository";
import { assertMainVendor, ownRequests } from "./vendor-scope";
import { notifyDelegated, notifyReminder } from "./vendor-team-notify";
import { canRemindNow } from "./vendor-team-rules";

/**
 * The Main Vendor hands a PENDING request to one of its ACTIVE team users (or takes
 * it back with handlerId null), and can remind that user. SPOC-RM's assignment and
 * the attempt history are untouched; only the handler of the pending attempt moves.
 */
@Injectable()
export class DelegateVendorRequestService {
  constructor(
    private readonly requests: VendorRequestsRepository,
    private readonly team: VendorTeamRepository,
  ) {}

  async delegate(
    actor: Actor,
    requestPublicId: string,
    input: DelegateVendorRequestDto,
  ) {
    assertMainVendor(actor);
    return this.requests.transaction(async (tx) => {
      const row = await this.pendingRequest(tx, actor, requestPublicId);
      if (row.version !== input.version)
        throw new ConflictException("Request changed; refresh and try again");
      const handler = input.handlerId
        ? await this.team.findMember(
            tx,
            actor.tenantId,
            actor.userId,
            input.handlerId,
            true,
          )
        : null;
      if (input.handlerId && !handler)
        throw new NotFoundException("Active team user not found");
      if ((handler?.id ?? null) === row.handlerUserId)
        throw new ConflictException("The request is already with this person");
      const updated = await this.requests.setHandler(
        tx,
        row,
        handler?.id ?? null,
      );
      if (updated.count !== 1)
        throw new ConflictException("Request changed; refresh and try again");
      await this.requests.recordAudit(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "vendor_assignment.delegated",
        resourceType: "vendor_assignment",
        resourcePublicId: row.publicId,
        beforeJson: JSON.stringify({ handler: row.handler?.publicId ?? null }),
        afterJson: JSON.stringify({ handler: handler?.publicId ?? null }),
      });
      if (handler)
        await notifyDelegated(tx, handler.id, this.notice(actor, row));
      return {
        id: row.publicId,
        version: row.version + 1,
        handler: handler
          ? { id: handler.publicId, name: handler.displayName }
          : null,
      };
    });
  }

  async remind(actor: Actor, requestPublicId: string) {
    assertMainVendor(actor);
    return this.requests.transaction(async (tx) => {
      const row = await this.pendingRequest(tx, actor, requestPublicId);
      if (!row.handlerUserId || !row.handler)
        throw new ConflictException(
          "Only a request delegated to a team user can be reminded",
        );
      const now = new Date();
      if (!canRemindNow(row.lastRemindedAt, now))
        throw new ConflictException(
          "A reminder was sent in the last hour; try again later",
        );
      await this.requests.markReminded(tx, row.id, now);
      await notifyReminder(tx, row.handlerUserId, this.notice(actor, row));
      await this.requests.recordAudit(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "vendor_assignment.reminded",
        resourceType: "vendor_assignment",
        resourcePublicId: row.publicId,
        afterJson: JSON.stringify({
          handler: row.handler.publicId,
          remindedAt: now,
        }),
      });
      return {
        id: row.publicId,
        remindedAt: now,
        handler: row.handler.displayName,
      };
    });
  }

  private async pendingRequest(
    tx: VendorTx,
    actor: Actor,
    requestPublicId: string,
  ) {
    const row = await this.requests.findOwnForDelegation(tx, {
      ...ownRequests(actor),
      publicId: requestPublicId,
    });
    if (!row) throw new NotFoundException("Request not found");
    if (row.status !== "PENDING")
      throw new ConflictException(
        "Only a pending request can be delegated or reminded",
      );
    return row;
  }

  private notice(
    actor: Actor,
    row: {
      case: { caseNumber: string };
      document: { type: string };
      client: { displayName: string };
    },
  ) {
    return {
      tenantId: actor.tenantId,
      caseNumber: row.case.caseNumber,
      documentType: row.document.type,
      clientName: row.client.displayName,
      ownerName: actor.displayName,
    };
  }
}
