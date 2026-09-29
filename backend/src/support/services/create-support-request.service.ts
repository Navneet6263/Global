import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../../common/auth/actor";
import { caseAccessScope } from "../../common/auth/access-scope";
import { isUniqueConflict } from "../../vendor-requests/services/vendor-rules";
import { SupportRepository } from "../support.repository";
import type {
  ClientSupportRequestDto,
  RaiseSupportRequestDto,
} from "../support.validation";
import { notifySupportAgents } from "./support-notify";
import { toRequesterView } from "./support-request-view";
import {
  OPEN_REQUEST_LIMIT,
  SUPPORT_MESSAGE_MAX,
  SUPPORT_SUBJECT_MAX,
  supportRequestNumber,
  supportText,
  type SupportRequesterType,
} from "./support-rules";

interface NewRequest {
  tenantId: bigint;
  requesterType: SupportRequesterType;
  requesterUserId: bigint | null;
  requesterLabel: string;
  clientId: bigint;
  clientName: string;
  caseId: bigint | null;
  input: RaiseSupportRequestDto;
}

/**
 * Raise a support request, from the candidate link or the Client Admin navbar. The
 * client and case are always resolved on the server, never taken from the body.
 */
@Injectable()
export class CreateSupportRequestService {
  constructor(private readonly repository: SupportRepository) {}

  /** Candidate path: client and case come from the verified portal token. */
  async forCandidate(
    access: {
      tenantId: bigint;
      caseId: bigint;
      clientId: bigint;
      clientName: string;
      candidateName: string;
    },
    input: RaiseSupportRequestDto,
  ) {
    return toRequesterView(
      await this.create({
        tenantId: access.tenantId,
        requesterType: "CANDIDATE",
        requesterUserId: null,
        requesterLabel: access.candidateName,
        clientId: access.clientId,
        clientName: access.clientName,
        caseId: access.caseId,
        input,
      }),
    );
  }

  /** Client Admin path: the client is the actor's own; a case must be in its own scope. */
  async forClientAdmin(actor: Actor, input: ClientSupportRequestDto) {
    if (!actor.clientId)
      throw new ForbiddenException(
        "Support requests need a linked client workspace",
      );
    const client = await this.repository.findClient(
      actor.tenantId,
      actor.clientId,
    );
    if (!client) throw new ForbiddenException("Client workspace not found");
    const caseNumber = input.caseNumber?.trim();
    const linked = caseNumber
      ? await this.repository.findCaseByNumber(
          caseAccessScope(actor),
          caseNumber,
        )
      : null;
    if (caseNumber && !linked)
      throw new NotFoundException("No case with that number in your workspace");
    const user = await this.repository.findUserName(
      actor.tenantId,
      actor.userId,
    );
    return toRequesterView(
      await this.create({
        tenantId: actor.tenantId,
        requesterType: "CLIENT_ADMIN",
        requesterUserId: actor.userId,
        requesterLabel: user?.displayName ?? "Client Admin",
        clientId: client.id,
        clientName: client.displayName,
        caseId: linked?.id ?? null,
        input,
      }),
    );
  }

  private async create(request: NewRequest) {
    const subject = supportText(
      request.input.subject,
      "Subject",
      SUPPORT_SUBJECT_MAX,
    );
    const message = supportText(
      request.input.message,
      "Message",
      SUPPORT_MESSAGE_MAX,
    );
    try {
      return await this.repository.transaction(async (tx) => {
        const open = await this.repository.countOpen(tx, {
          tenantId: request.tenantId,
          requesterType: request.requesterType,
          ...(request.requesterType === "CANDIDATE"
            ? { caseId: request.caseId }
            : { requesterUserId: request.requesterUserId }),
        });
        if (open >= OPEN_REQUEST_LIMIT[request.requesterType])
          throw new ConflictException(
            "You already have several open support requests; please wait for a reply",
          );
        const row = await this.repository.create(tx, {
          tenantId: request.tenantId,
          requestNumber: supportRequestNumber(),
          requesterType: request.requesterType,
          requesterUserId: request.requesterUserId,
          clientId: request.clientId,
          caseId: request.caseId,
          subject,
          message,
        });
        await this.repository.recordAudit(tx, {
          tenantId: request.tenantId,
          actorUserId: request.requesterUserId,
          action: "support_request.created",
          resourceType: "support_request",
          resourcePublicId: row.publicId,
          afterJson: JSON.stringify({
            requestNumber: row.requestNumber,
            requesterType: request.requesterType,
            caseNumber: row.case?.caseNumber ?? null,
            subject,
            status: "OPEN",
          }),
        });
        await notifySupportAgents(tx, {
          tenantId: request.tenantId,
          requestPublicId: row.publicId,
          requestNumber: row.requestNumber,
          subject,
          clientName: request.clientName,
          requesterLabel:
            request.requesterType === "CANDIDATE"
              ? `candidate ${request.requesterLabel}`
              : `Client Admin ${request.requesterLabel}`,
        });
        return row;
      });
    } catch (error) {
      if (isUniqueConflict(error))
        throw new ConflictException(
          "Could not number the request; please submit again",
        );
      throw error;
    }
  }
}
