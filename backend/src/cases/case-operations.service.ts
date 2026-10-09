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
  ClientEscalateCaseDto,
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
    // Platform Admin oversight escalates internally: Operations and the case owner act,
    // the client is not told. Operations escalation keeps the client-attention notice.
    const internal = !actor.roles.includes("OPS_MANAGER");
    const note =
      input.note?.trim() ||
      (internal
        ? "Platform Admin escalated this case for priority handling."
        : "Operations escalated this case for client attention.");
    const now = new Date();

    const recipients = internal
      ? await this.prisma.user.findMany({
          where: {
            tenantId: actor.tenantId,
            status: "ACTIVE",
            id: { not: actor.userId },
            OR: [
              { userRoles: { some: { role: { code: "OPS_MANAGER" } } } },
              ...(current.assignedOpsUser
                ? [{ id: current.assignedOpsUser.id }]
                : []),
            ],
          },
          select: { id: true },
        })
      : await this.prisma.user.findMany({
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
        data: {
          priority: "URGENT",
          escalatedAt: now,
          escalatedById: actor.userId,
          escalationNote: note.slice(0, 500),
          version: { increment: 1 },
        },
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
            caseNumber: current.caseNumber,
            priority: "URGENT",
            version: current.version + 1,
            note,
            internal,
          }),
        },
      });
      if (recipients.length) {
        await tx.notification.createMany({
          data: recipients.map((user) => ({
            tenantId: actor.tenantId,
            userId: user.id,
            type: "CASE_ESCALATED",
            title: internal
              ? "Escalated: handle on high priority"
              : "Verification case needs attention",
            body: `${current.caseNumber}: ${note}`.slice(0, 1000),
            href: internal ? `/cases/${publicId}` : "/client-portal",
          })),
        });
      }
    });
    return {
      id: publicId,
      priority: "URGENT",
      version: current.version + 1,
      escalated: true,
      escalatedAt: now,
    };
  }
  /**
   * The Company Admin escalates one of its own cases with a reason. The case becomes
   * high priority and its RM and the Operations Managers are told. Audited; a case that
   * is already escalated is not escalated again.
   */
  async clientEscalate(
    actor: Actor,
    publicId: string,
    input: ClientEscalateCaseDto,
  ) {
    if (!actor.roles.includes("CLIENT_ADMIN") || !actor.clientId)
      throw new ForbiddenException("Only the company admin can escalate here");
    const current = await this.findCase(actor, publicId);
    this.assertMutable(current.status, current.version, input.version);
    if (current.escalatedAt)
      throw new ConflictException(
        "This case is already escalated. Your RM is handling it on priority.",
      );
    const reason = input.reason.trim();
    const now = new Date();
    const recipients = await this.prisma.user.findMany({
      where: {
        tenantId: actor.tenantId,
        status: "ACTIVE",
        OR: [
          { userRoles: { some: { role: { code: "OPS_MANAGER" } } } },
          ...(current.assignedOpsUser
            ? [{ id: current.assignedOpsUser.id }]
            : []),
        ],
      },
      select: { id: true },
    });
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.verificationCase.updateMany({
        where: {
          id: current.id,
          tenantId: actor.tenantId,
          clientId: actor.clientId,
          version: input.version,
          escalatedAt: null,
          status: { notIn: TERMINAL_STATES },
        },
        data: {
          priority: "URGENT",
          escalatedAt: now,
          escalatedById: actor.userId,
          escalationNote: `Client: ${reason}`.slice(0, 500),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException("Case changed; refresh and try again");
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
            caseNumber: current.caseNumber,
            priority: "URGENT",
            version: current.version + 1,
            note: reason,
            source: "CLIENT",
          }),
        },
      });
      if (recipients.length)
        await tx.notification.createMany({
          data: recipients.map((user) => ({
            tenantId: actor.tenantId,
            userId: user.id,
            type: "CASE_ESCALATED",
            title: "Client escalated: handle on high priority",
            body: `${current.caseNumber}: ${reason}`.slice(0, 1000),
            href: `/cases/${publicId}`,
          })),
        });
    });
    return {
      id: publicId,
      priority: "URGENT",
      version: current.version + 1,
      escalated: true,
      escalatedAt: now,
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
          {
            OR: [
              { userRoles: { some: { role: { code: "OPS_MANAGER" } } } },
              // An RM can own only cases of a client mapped to their workspace.
              {
                userRoles: { some: { role: { code: "SPOC_RM" } } },
                spocClientScopes: { some: { clientId: current.clientId } },
              },
            ],
          },
        ],
      },
      select: {
        id: true,
        publicId: true,
        displayName: true,
        branchId: true,
        userRoles: { select: { role: { select: { code: true } } } },
      },
    });
    if (!owner)
      throw new NotFoundException("Active operations owner or RM not found");
    const ownerIsOperations = owner.userRoles.some(
      ({ role }) => role.code === "OPS_MANAGER",
    );
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
            ownerName: owner.displayName,
            caseNumber: current.caseNumber,
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
          title: ownerIsOperations
            ? "Operations case assigned"
            : "Case assigned to you as RM",
          body: ownerIsOperations
            ? `${current.caseNumber} is now in your operations queue.`
            : `${current.caseNumber} is now assigned to you as the responsible RM.`,
          href: ownerIsOperations
            ? `/cases/${publicId}`
            : `/spoc-rm/records?domain=cases&search=${encodeURIComponent(current.caseNumber)}`,
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
          escalatedAt: true,
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
