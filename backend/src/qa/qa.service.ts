import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { QaDecisionDto } from "./dto/qa-decision.dto";
import type { QaQueryDto } from "./dto/qa-query.dto";
import { readQaQueue } from "./qa-queue-reader";
import { decideQaCase } from "./qa-decision";
import { changeReservation } from "./qa-reservation";
import { claimCutoff } from "./qa-claim";
import type { QaRegisterQueryDto } from "./dto/qa-register-query.dto";
import { readQaDetail, readQaRegister } from "./qa-register";
import { readQaHistory } from "./qa-history-reader";
import { fieldQaWhere } from "../field-visits/physical-field-policy";

@Injectable()
export class QaService {
  constructor(private readonly prisma: PrismaService) {}

  register(actor: Actor, query: QaRegisterQueryDto) {
    return readQaRegister(this.prisma, actor, query);
  }

  detail(actor: Actor, caseId: string) {
    return readQaDetail(this.prisma, actor, caseId);
  }

  history(actor: Actor, query: QaRegisterQueryDto) {
    return readQaHistory(this.prisma, actor, query);
  }

  queue(actor: Actor, query: QaQueryDto) {
    return readQaQueue(this.prisma, actor, query);
  }

  async claim(actor: Actor, casePublicId: string, caseVersion: number) {
    const record = await this.prisma.verificationCase.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: casePublicId,
        ...(actor.branchId ? { branchId: actor.branchId } : {}),
        ...(actor.clientId ? { clientId: actor.clientId } : {}),
      },
      select: {
        id: true,
        status: true,
        version: true,
        qaReviewerId: true,
        qaClaimedAt: true,
      },
    });
    if (!record) throw new NotFoundException("Case not found");
    if (record.status !== "QA_REVIEW")
      throw new ConflictException("Case is not awaiting QA review");
    if (record.version !== caseVersion)
      throw new ConflictException("Case changed; refresh and try again");
    const expired = !record.qaClaimedAt || record.qaClaimedAt <= claimCutoff();
    if (
      record.qaReviewerId &&
      record.qaReviewerId !== actor.userId &&
      !expired
    ) {
      throw new ConflictException(
        "Another reviewer is currently working on this case",
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.verificationCase.updateMany({
        where: {
          id: record.id,
          version: caseVersion,
          status: "QA_REVIEW",
          AND: [fieldQaWhere()],
        },
        data: {
          qaReviewerId: actor.userId,
          qaClaimedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          "Case changed or required field verification is incomplete. Ask Operations to complete the field work before QA.",
        );
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "qa.case-claimed",
          resourceType: "case",
          resourcePublicId: casePublicId,
        },
      });
    });
    return {
      id: casePublicId,
      claimedBy: actor.userPublicId,
      caseVersion: caseVersion + 1,
    };
  }

  decide(actor: Actor, casePublicId: string, input: QaDecisionDto) {
    return decideQaCase(this.prisma, actor, casePublicId, input);
  }

  reservation(
    actor: Actor,
    caseId: string,
    version: number,
    action: "renew" | "release",
  ) {
    return changeReservation(this.prisma, actor, caseId, version, action);
  }
}
