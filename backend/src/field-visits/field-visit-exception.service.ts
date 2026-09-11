import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { caseAccessScope } from "../common/auth/access-scope";
import type { Actor } from "../common/auth/actor";
import { assertAnyRole, OPERATIONS_ROLES } from "../common/auth/roles";
import { PrismaService } from "../database/prisma.service";
import type { ReviewFieldExceptionDto } from "./dto/review-field-exception.dto";
import { QaReadinessService } from "../verification/qa-readiness.service";
import { lockMutableCaseEvidence } from "../documents/upload-document-policy";

@Injectable()
export class FieldVisitExceptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qaReadiness: QaReadinessService,
  ) {}

  async review(
    actor: Actor,
    visitPublicId: string,
    input: ReviewFieldExceptionDto,
  ) {
    assertAnyRole(
      actor,
      OPERATIONS_ROLES,
      "Only operations can review field exceptions",
    );
    const visit = await this.prisma.fieldVisit.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: visitPublicId,
        status: { in: ["EXCEPTION_REVIEW", "REVIEW_PENDING"] },
        case: caseAccessScope(actor),
      },
      select: {
        id: true,
        version: true,
        status: true,
        assigneeId: true,
        remarks: true,
        case: {
          select: {
            id: true,
            publicId: true,
            caseNumber: true,
            status: true,
            branchId: true,
            clientId: true,
          },
        },
      },
    });
    if (!visit) throw new NotFoundException("Field exception not found");
    if (visit.version !== input.version) {
      throw new ConflictException("Visit changed; refresh and try again");
    }
    if (!["IN_PROGRESS", "CLARIFICATION_PENDING"].includes(visit.case.status)) {
      throw new ConflictException(
        "Return the case to verification before reviewing field evidence",
      );
    }
    if (visit.assigneeId === actor.userId)
      throw new ConflictException(
        "Another supervisor must review your field visit",
      );

    const approved = input.decision === "APPROVE";
    const nextStatus = approved ? "COMPLETED" : "ASSIGNED";
    await this.prisma.$transaction(async (tx) => {
      await lockMutableCaseEvidence(tx, visit.case.id);
      const updated = await tx.fieldVisit.updateMany({
        where: {
          id: visit.id,
          version: input.version,
          status: { in: ["EXCEPTION_REVIEW", "REVIEW_PENDING"] },
        },
        data: approved
          ? {
              status: nextStatus,
              completedAt: new Date(),
              completedById: actor.userId,
              remarks: input.note?.trim() || visit.remarks,
              version: { increment: 1 },
            }
          : {
              status: nextStatus,
              capturedLatitude: null,
              capturedLongitude: null,
              accuracyMeters: null,
              distanceMeters: null,
              capturedAt: null,
              completedAt: null,
              completedById: null,
              checklistJson: null,
              evidenceSince: new Date(),
              checkInLatitude: null,
              checkInLongitude: null,
              checkInAccuracy: null,
              checkedInAt: null,
              remarks:
                input.note?.trim() ||
                "Supervisor requested a new field capture",
              version: { increment: 1 },
            },
      });
      if (updated.count !== 1) {
        throw new ConflictException("Visit was reviewed concurrently");
      }
      if (approved && visit.case.status === "IN_PROGRESS") {
        await this.qaReadiness.promoteIfReady(tx, {
          tenantId: actor.tenantId,
          caseId: visit.case.id,
          casePublicId: visit.case.publicId,
          branchId: visit.case.branchId,
          clientId: visit.case.clientId,
          changedById: actor.userId,
          fromStatus: "IN_PROGRESS",
          reason: "Required field evidence accepted by supervisor",
        });
      }
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: approved
            ? visit.status === "REVIEW_PENDING"
              ? "field_visit.supervisor-approved"
              : "field_visit.exception-approved"
            : "field_visit.retry-requested",
          resourceType: "field_visit",
          resourcePublicId: visitPublicId,
          beforeJson: JSON.stringify({ status: visit.status }),
          afterJson: JSON.stringify({
            status: nextStatus,
            decision: input.decision,
            note: input.note?.trim(),
          }),
        },
      });
      if (visit.assigneeId) {
        await tx.notification.create({
          data: {
            tenantId: actor.tenantId,
            userId: visit.assigneeId,
            type: approved ? "FIELD_VISIT_APPROVED" : "FIELD_VISIT_RETRY",
            title: approved
              ? "Field visit approved"
              : "Field visit retry required",
            body: `${visit.case.caseNumber}: ${input.note?.trim() || (approved ? "Supervisor approved the field evidence." : "Capture fresh location and evidence.")}`,
            href: "/field-executive",
          },
        });
      }
    });
    return {
      id: visitPublicId,
      status: nextStatus,
      version: input.version + 1,
    };
  }
}
