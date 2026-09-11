import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { caseAccessScope } from "../common/auth/access-scope";
import type { Actor } from "../common/auth/actor";
import { assertAnyRole, OPERATIONS_ROLES } from "../common/auth/roles";
import { PrismaService } from "../database/prisma.service";
import type { CreateFieldVisitDto } from "./dto/create-field-visit.dto";
import { lockMutableCaseEvidence } from "../documents/upload-document-policy";
import { fieldAssigneeScope } from "./field-assignee-scope";
import type { FieldAssigneeQueryDto } from "./dto/field-assignee-query.dto";

@Injectable()
export class FieldVisitAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async eligibleAssignees(
    actor: Actor,
    casePublicId: string,
    query: FieldAssigneeQueryDto,
  ) {
    assertAnyRole(
      actor,
      OPERATIONS_ROLES,
      "Only operations can assign field visits",
    );
    const scope = await this.prisma.verificationCase.findFirst({
      where: { ...caseAccessScope(actor), publicId: casePublicId },
      select: { branchId: true, clientId: true },
    });
    if (!scope) throw new NotFoundException("Case not found");
    const where = fieldAssigneeScope(actor.tenantId, scope);
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: { publicId: true, displayName: true, email: true },
        orderBy: [{ displayName: "asc" }, { publicId: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: rows.map(({ publicId, ...user }) => ({ id: publicId, ...user })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async create(actor: Actor, casePublicId: string, input: CreateFieldVisitDto) {
    assertAnyRole(
      actor,
      OPERATIONS_ROLES,
      "Only operations can assign field visits",
    );
    const verificationCase = await this.prisma.verificationCase.findFirst({
      where: { ...caseAccessScope(actor), publicId: casePublicId },
      select: {
        id: true,
        publicId: true,
        caseNumber: true,
        branchId: true,
        clientId: true,
        status: true,
      },
    });
    if (!verificationCase) throw new NotFoundException("Case not found");
    if (
      !["IN_PROGRESS", "CLARIFICATION_PENDING"].includes(
        verificationCase.status,
      )
    ) {
      throw new ConflictException(
        "Field work can be assigned only while verification is in progress",
      );
    }

    const assignee = await this.prisma.user.findFirst({
      where: {
        ...fieldAssigneeScope(actor.tenantId, verificationCase),
        publicId: input.assigneeId,
      },
      select: { id: true },
    });
    if (!assignee)
      throw new NotFoundException("Active field executive not found");

    const policy = await this.prisma.tenantFieldPolicy.findUnique({
      where: { tenantId: actor.tenantId },
      select: { defaultRadiusMeters: true },
    });
    const visit = await this.prisma.$transaction(async (tx) => {
      // Serialize with check completion and invalidate stale QA decisions.
      await lockMutableCaseEvidence(tx, verificationCase.id);
      const created = await tx.fieldVisit.create({
        data: {
          tenantId: actor.tenantId,
          caseId: verificationCase.id,
          assigneeId: assignee.id,
          address: input.address.trim(),
          targetLatitude: input.latitude,
          targetLongitude: input.longitude,
          geofenceMeters:
            input.geofenceMeters ?? policy?.defaultRadiusMeters ?? 150,
        },
        select: {
          publicId: true,
          status: true,
          address: true,
          geofenceMeters: true,
          version: true,
          createdAt: true,
        },
      });
      await tx.notification.create({
        data: {
          tenantId: actor.tenantId,
          userId: assignee.id,
          type: "FIELD_VISIT_ASSIGNED",
          title: "Field visit assigned",
          body: `${verificationCase.caseNumber}: ${created.address}`,
          href: "/field-executive",
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "field_visit.assigned",
          resourceType: "field_visit",
          resourcePublicId: created.publicId,
          afterJson: JSON.stringify({
            caseId: verificationCase.publicId,
            assigneeId: input.assigneeId,
            geofenceMeters: created.geofenceMeters,
          }),
        },
      });
      return created;
    });
    return {
      id: visit.publicId,
      status: visit.status,
      address: visit.address,
      geofenceMeters: visit.geofenceMeters,
      version: visit.version,
      createdAt: visit.createdAt,
    };
  }
}
