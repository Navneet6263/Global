import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../../common/auth/actor";
import { supportScope } from "../../common/auth/access-scope";
import { SupportRepository } from "../support.repository";
import type { UpdateSupportRequestDto } from "../support.validation";
import { SupportInboxService } from "./support-inbox.service";
import { notifySupportRequester } from "./support-notify";
import {
  SUPPORT_MESSAGE_MAX,
  assertSupportTransition,
  supportText,
} from "./support-rules";

/**
 * The only support write an agent has: take a request (IN_PROGRESS) or resolve it
 * with a reply (RESOLVED). Version-checked and audited; the Client Admin who raised
 * it is notified.
 */
@Injectable()
export class UpdateSupportRequestService {
  constructor(
    private readonly repository: SupportRepository,
    private readonly inbox: SupportInboxService,
  ) {}

  async update(actor: Actor, publicId: string, input: UpdateSupportRequestDto) {
    const note =
      input.status === "RESOLVED"
        ? supportText(input.note, "Resolution note", SUPPORT_MESSAGE_MAX)
        : null;
    await this.repository.transaction(async (tx) => {
      const current = await this.repository.findForUpdate(tx, {
        ...supportScope(actor),
        publicId,
      });
      if (!current) throw new NotFoundException("Support request not found");
      if (current.version !== input.version)
        throw new ConflictException("Request changed; refresh and try again");
      assertSupportTransition(current.status, input.status);
      const updated = await this.repository.updateStatus(tx, current, {
        status: input.status,
        assignedToId:
          input.status === "IN_PROGRESS"
            ? actor.userId
            : (current.assignedToId ?? actor.userId),
        ...(input.status === "RESOLVED"
          ? { resolutionNote: note, resolvedAt: new Date() }
          : {}),
      });
      if (updated.count !== 1)
        throw new ConflictException("Request changed; refresh and try again");
      await this.repository.recordAudit(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "support_request.status_changed",
        resourceType: "support_request",
        resourcePublicId: publicId,
        beforeJson: JSON.stringify({ status: current.status }),
        afterJson: JSON.stringify({
          requestNumber: current.requestNumber,
          status: input.status,
          resolutionNote: note,
        }),
      });
      if (current.requesterType === "CLIENT_ADMIN" && current.requesterUserId)
        await notifySupportRequester(tx, {
          tenantId: actor.tenantId,
          userId: current.requesterUserId,
          requestNumber: current.requestNumber,
          status: input.status,
        });
    });
    return this.inbox.detail(actor, publicId);
  }
}
