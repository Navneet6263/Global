import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { PrismaService } from "../database/prisma.service";
import type { Prisma } from "../generated/prisma/client";
import type {
  CreateVerificationMethodDto,
  RespondVerificationMethodDto,
} from "./dto/verification-method.dto";
import {
  captureMethodEvidence,
  parseMethodEvidence,
} from "./method-evidence.policy";

const methodSelect = {
  publicId: true,
  method: true,
  status: true,
  result: true,
  provider: true,
  reference: true,
  sourceContact: true,
  requestedAt: true,
  respondedAt: true,
  dueAt: true,
  nextFollowUpAt: true,
  summary: true,
  evidenceJson: true,
  version: true,
} as const;

@Injectable()
export class VerificationMethodsService {
  constructor(private readonly prisma: PrismaService) {}

  async check(
    actor: Actor,
    checkId: string,
    write = false,
    database: Prisma.TransactionClient = this.prisma,
  ) {
    const manager = actor.roles.some((role) =>
      ["OPS_MANAGER", "PLATFORM_ADMIN"].includes(role),
    );
    const check = await database.caseCheck.findFirst({
      where: {
        publicId: checkId,
        tenantId: actor.tenantId,
        case: caseAccessScope(actor),
        ...(write && !manager
          ? {
              tasks: {
                some: {
                  assigneeId: actor.userId,
                  status: { not: "COMPLETED" },
                },
              },
            }
          : {}),
      },
      include: {
        case: {
          select: {
            id: true,
            publicId: true,
            caseNumber: true,
            status: true,
            version: true,
          },
        },
      },
    });
    if (!check)
      throw new NotFoundException(
        "Verification check not found or not assigned to you",
      );
    if (
      write &&
      (check.case.status !== "IN_PROGRESS" || check.status === "COMPLETED")
    ) {
      throw new ConflictException(
        "Source work is locked until the case/check is in active verification",
      );
    }
    return check;
  }

  async list(actor: Actor, checkId: string) {
    const check = await this.check(actor, checkId);
    const today = new Date(new Date().toISOString().slice(0, 10));
    const evidenceDocuments = await this.prisma.document.findMany({
      where: {
        caseId: check.caseId,
        status: "VERIFIED",
        currentVersion: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gte: today } }],
      },
      select: {
        publicId: true,
        type: true,
        status: true,
        currentVersion: true,
      },
      orderBy: [{ type: "asc" }, { createdAt: "desc" }],
    });
    const items = await this.prisma.verificationMethodRun.findMany({
      where: { checkId: check.id },
      select: methodSelect,
      orderBy: [{ requestedAt: "desc" }, { id: "desc" }],
      take: 100,
    });
    return {
      items: items.map(({ publicId, evidenceJson, ...run }) => ({
        id: publicId,
        ...run,
        evidenceIds: parseMethodEvidence(evidenceJson).map(
          (entry) => entry.documentId,
        ),
      })),
      caseStatus: check.case.status,
      evidenceDocuments,
      digitalMode: "RECORDED_EVIDENCE" as const,
    };
  }

  async create(
    actor: Actor,
    checkId: string,
    input: CreateVerificationMethodDto,
  ) {
    const check = await this.check(actor, checkId, true);
    if (
      input.method !== "MANUAL" &&
      (!input.provider?.trim() || !input.sourceContact?.trim())
    ) {
      throw new BadRequestException(
        "Record the provider/source and source contact for this method",
      );
    }
    return this.prisma.$transaction(async (tx) => {
      await this.lockCase(tx, check.case);
      await this.check(actor, checkId, true, tx);
      if (
        await tx.verificationMethodRun.count({
          where: {
            checkId: check.id,
            method: input.method,
            status: { not: "SUPERSEDED" },
          },
        })
      ) {
        throw new ConflictException(
          "This method already has an active request; respond to it or use controlled re-verification",
        );
      }
      const run = await tx.verificationMethodRun.create({
        data: {
          checkId: check.id,
          method: input.method,
          provider: input.provider?.trim(),
          sourceContact: input.sourceContact?.trim(),
          dueAt: input.dueAt ? new Date(input.dueAt) : check.dueAt,
          createdById: actor.userId,
        },
        select: methodSelect,
      });
      await this.audit(
        tx,
        actor,
        check.case.publicId,
        "verification.method-requested",
        { checkId, methodId: run.publicId, method: run.method },
      );
      return { id: run.publicId, status: run.status, version: run.version };
    });
  }

  async respond(
    actor: Actor,
    checkId: string,
    methodId: string,
    input: RespondVerificationMethodDto,
  ) {
    if (input.summary.trim().length < 10)
      throw new BadRequestException(
        "Record a factual source summary of at least 10 characters",
      );
    const check = await this.check(actor, checkId, true);
    return this.prisma.$transaction(async (tx) => {
      await this.lockCase(tx, check.case);
      await this.check(actor, checkId, true, tx);
      const run = await tx.verificationMethodRun.findFirst({
        where: { publicId: methodId, checkId: check.id },
      });
      if (!run) throw new NotFoundException("Source request not found");
      if (run.status !== "REQUESTED" || run.version !== input.version)
        throw new ConflictException(
          "Source response changed; refresh before continuing",
        );
      if (
        run.method !== "MANUAL" &&
        (!input.reference?.trim() || !input.evidenceIds.length)
      ) {
        throw new BadRequestException(
          "Digital/third-party responses need a source reference and reviewed supporting document",
        );
      }
      const evidence = await captureMethodEvidence(
        tx,
        check.caseId,
        input.evidenceIds,
        input.evidenceVersions ?? [],
      );
      const respondedAt = new Date();
      const updated = await tx.verificationMethodRun.updateMany({
        where: { id: run.id, version: input.version, status: "REQUESTED" },
        data: {
          status: "RESPONDED",
          result: input.result,
          summary: input.summary.trim(),
          reference: input.reference?.trim(),
          evidenceJson: JSON.stringify(evidence),
          respondedAt,
          nextFollowUpAt: null,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException("Source response was updated concurrently");
      await this.audit(
        tx,
        actor,
        check.case.publicId,
        "verification.method-responded",
        {
          checkId,
          methodId,
          method: run.method,
          result: input.result,
          evidence,
        },
      );
      return {
        id: methodId,
        status: "RESPONDED",
        version: input.version + 1,
        respondedAt,
      };
    });
  }

  async lockCase(
    tx: Prisma.TransactionClient,
    row: { id: bigint; version: number },
  ) {
    const updated = await tx.verificationCase.updateMany({
      where: { id: row.id, version: row.version, status: "IN_PROGRESS" },
      data: { version: { increment: 1 } },
    });
    if (updated.count !== 1)
      throw new ConflictException(
        "Case changed; refresh before recording source work",
      );
  }

  private audit(
    tx: Prisma.TransactionClient,
    actor: Actor,
    caseId: string,
    action: string,
    detail: Record<string, unknown>,
  ) {
    return tx.auditEvent.create({
      data: {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action,
        resourceType: "case",
        resourcePublicId: caseId,
        afterJson: JSON.stringify(detail),
      },
    });
  }
}
