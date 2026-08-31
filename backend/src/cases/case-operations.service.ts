import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { caseAccessScope } from "../common/auth/access-scope";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type {
  AssignCaseOwnerDto,
  EscalateCaseDto,
} from "./dto/case-operations.dto";

const TERMINAL_STATES = ["COMPLETED", "CLOSED", "CANCELLED"];

@Injectable()
export class CaseOperationsService {
  constructor(private readonly prisma: PrismaService) {}

  async escalate(actor: Actor, publicId: string, input: EscalateCaseDto) {
    this.assertOperationsRole(actor);
    const current = await this.findCase(actor, publicId);
    this.assertMutable(current.status, current.version, input.version);
    const note =
      input.note?.trim() ||
      "Operations escalated this case for client attention.";

    const clientAdmins = await this.prisma.user.findMany({
      where: {
        tenantId: actor.tenantId,
        clientId: current.clientId,
        status: "ACTIVE",
        userRoles: { some: { role: { code: "CLIENT_ADMIN" } } },
      },
      select: { id: true },
    });
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.verificationCase.updateMany({
        where: {
          id: current.id,
          tenantId: actor.tenantId,
          version: input.version,
          status: { notIn: TERMINAL_STATES },
        },
        data: { priority: "URGENT", version: { increment: 1 } },
      });
      if (updated.count !== 1) {
        throw new ConflictException("Case changed; refresh and try again");
      }
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "case.escalated",
          resourceType: "case",
          resourcePublicId: publicId,
          beforeJson: JSON.stringify({
            priority: current.priority,
            version: current.version,
          }),
          afterJson: JSON.stringify({
            priority: "URGENT",
            version: current.version + 1,
            note,
          }),
        },
      });
      if (clientAdmins.length) {
        await tx.notification.createMany({
          data: clientAdmins.map((user) => ({
            tenantId: actor.tenantId,
            userId: user.id,
            type: "CASE_ESCALATED",
            title: "Verification case needs attention",
            body: `${current.caseNumber}: ${note}`,
            href: "/client-portal",
          })),
        });
      }
    });
    return {
      id: publicId,
      priority: "URGENT",
      version: current.version + 1,
      escalated: true,
    };
  }

  async assignOwner(actor: Actor, publicId: string, input: AssignCaseOwnerDto) {
    this.assertOperationsRole(actor);
    const current = await this.findCase(actor, publicId);
    this.assertMutable(current.status, current.version, input.version);
    const owner = await this.prisma.user.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: input.ownerId,
        status: "ACTIVE",
        AND: [
          current.branchId
            ? { OR: [{ branchId: current.branchId }, { branchId: null }] }
            : actor.roles.includes("PLATFORM_ADMIN")
              ? {}
              : { OR: [{ branchId: actor.branchId }, { branchId: null }] },
          { OR: [{ clientId: null }, { clientId: current.clientId }] },
        ],
        userRoles: { some: { role: { code: "OPS_MANAGER" } } },
      },
      select: { id: true, publicId: true, displayName: true, branchId: true },
    });
    if (!owner)
      throw new NotFoundException("Active operations owner not found");
    if (current.assignedOpsUser?.id === owner.id) {
      throw new ConflictException(
        "Case is already assigned to this operations owner",
      );
    }
    const note = input.note?.trim();

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.verificationCase.updateMany({
        where: {
          id: current.id,
          tenantId: actor.tenantId,
          version: input.version,
          status: { notIn: TERMINAL_STATES },
        },
        data: {
          assignedOpsUserId: owner.id,
          branchId: current.branchId ?? owner.branchId,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException(
          "Case owner changed; refresh and try again",
        );
      }
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "case.owner-assigned",
          resourceType: "case",
          resourcePublicId: publicId,
          beforeJson: JSON.stringify({
            ownerId: current.assignedOpsUser?.publicId ?? null,
            version: current.version,
          }),
          afterJson: JSON.stringify({
            ownerId: owner.publicId,
            version: current.version + 1,
            note,
          }),
        },
      });
      await tx.notification.create({
        data: {
          tenantId: actor.tenantId,
          userId: owner.id,
          type: "CASE_OWNER_ASSIGNED",
          title: "Operations case assigned",
          body: `${current.caseNumber} is now in your operations queue.`,
          href: `/cases/${publicId}`,
        },
      });
    });
    return {
      id: publicId,
      owner: { id: owner.publicId, displayName: owner.displayName },
      version: current.version + 1,
    };
  }

  private findCase(actor: Actor, publicId: string) {
    return this.prisma.verificationCase
      .findFirst({
        where: { ...caseAccessScope(actor), publicId },
        select: {
          id: true,
          clientId: true,
          branchId: true,
          caseNumber: true,
          status: true,
          priority: true,
          version: true,
          assignedOpsUser: { select: { id: true, publicId: true } },
        },
      })
      .then((record) => {
        if (!record) throw new NotFoundException("Case not found");
        return record;
      });
  }

  private assertMutable(
    status: string,
    currentVersion: number,
    expectedVersion: number,
  ) {
    if (currentVersion !== expectedVersion) {
      throw new ConflictException("Case changed; refresh and try again");
    }
    if (TERMINAL_STATES.includes(status)) {
      throw new ConflictException(
        "Completed or cancelled cases cannot be changed",
      );
    }
  }

  private assertOperationsRole(actor: Actor) {
    if (
      !actor.roles.some((role) =>
        ["PLATFORM_ADMIN", "OPS_MANAGER"].includes(role),
      )
    ) {
      throw new ForbiddenException(
        "Only operations can manage case ownership and escalation",
      );
    }
  }
}
