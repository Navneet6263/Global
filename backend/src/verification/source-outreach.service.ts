import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type {
  OutreachQueryDto,
  SourceOutreachDto,
} from "./dto/source-outreach.dto";
import { VerificationMethodsService } from "./verification-methods.service";
import { outreachDates, sourceRequestTemplate } from "./source-outreach.policy";

@Injectable()
export class SourceOutreachService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly methods: VerificationMethodsService,
  ) {}

  async list(
    actor: Actor,
    checkId: string,
    methodId: string,
    query: OutreachQueryDto,
  ) {
    const check = await this.methods.check(actor, checkId);
    const run = await this.prisma.verificationMethodRun.findFirst({
      where: { checkId: check.id, publicId: methodId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException("Source request not found");
    const where = { methodRunId: run.id };
    const [total, rows] = await Promise.all([
      this.prisma.sourceOutreach.count({ where }),
      this.prisma.sourceOutreach.findMany({
        where,
        orderBy: { id: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          publicId: true,
          channel: true,
          outcome: true,
          notes: true,
          occurredAt: true,
          createdAt: true,
          nextFollowUpAt: true,
          actor: { select: { displayName: true } },
        },
      }),
    ]);
    return {
      items: rows.map(({ publicId, actor: by, ...row }) => ({
        id: publicId,
        ...row,
        actorName: by.displayName,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      template: sourceRequestTemplate(check.type, check.case.caseNumber),
    };
  }

  async record(
    actor: Actor,
    checkId: string,
    methodId: string,
    input: SourceOutreachDto,
  ) {
    const check = await this.methods.check(actor, checkId, true);
    return this.prisma.$transaction(async (tx) => {
      await this.methods.lockCase(tx, check.case);
      await this.methods.check(actor, checkId, true, tx);
      const run = await tx.verificationMethodRun.findFirst({
        where: { checkId: check.id, publicId: methodId },
      });
      if (!run) throw new NotFoundException("Source request not found");
      if (run.status !== "REQUESTED" || run.version !== input.version)
        throw new ConflictException(
          "Source request changed or closed; refresh before recording contact",
        );
      const dates = outreachDates(input, run.requestedAt);
      const changed = await tx.verificationMethodRun.updateMany({
        where: { id: run.id, version: input.version, status: "REQUESTED" },
        data: {
          nextFollowUpAt: dates.nextFollowUpAt,
          version: { increment: 1 },
        },
      });
      if (changed.count !== 1)
        throw new ConflictException("Source request changed concurrently");
      const created = await tx.sourceOutreach.create({
        data: {
          methodRunId: run.id,
          actorUserId: actor.userId,
          channel: input.channel,
          outcome: input.outcome,
          ...dates,
        },
        select: { publicId: true },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "verification.source-contact-recorded",
          resourceType: "case",
          resourcePublicId: check.case.publicId,
          afterJson: JSON.stringify({
            checkId,
            methodId,
            outreachId: created.publicId,
            channel: input.channel,
            outcome: input.outcome,
            occurredAt: dates.occurredAt,
            nextFollowUpAt: dates.nextFollowUpAt,
          }),
        },
      });
      return { id: created.publicId, version: input.version + 1 };
    });
  }
}
