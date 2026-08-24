import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { CompleteFieldVisitDto } from "./dto/complete-field-visit.dto";
import type { CreateFieldVisitDto } from "./dto/create-field-visit.dto";
import type { ReviewFieldExceptionDto } from "./dto/review-field-exception.dto";
import { haversineMeters } from "./geo";

@Injectable()
export class FieldVisitsService {
  constructor(private readonly prisma: PrismaService) {}

  async mine(actor: Actor) {
    const [visits, policy] = await Promise.all([
      this.prisma.fieldVisit.findMany({
        where: {
          tenantId: actor.tenantId,
          assigneeId: actor.userId,
          status: {
            in: ["ASSIGNED", "IN_PROGRESS", "EXCEPTION_REVIEW", "COMPLETED"],
          },
        },
        select: {
          publicId: true,
          status: true,
          address: true,
          targetLatitude: true,
          targetLongitude: true,
          geofenceMeters: true,
          capturedAt: true,
          distanceMeters: true,
          version: true,
          case: {
            select: {
              publicId: true,
              caseNumber: true,
              subject: { select: { fullName: true } },
              client: { select: { displayName: true } },
            },
          },
          evidence: {
            select: {
              publicId: true,
              type: true,
              capturedAt: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      }),
      this.prisma.tenantFieldPolicy.findUnique({
        where: { tenantId: actor.tenantId },
        select: {
          defaultRadiusMeters: true,
          maxAccuracyMeters: true,
          minimumPhotos: true,
          retentionDays: true,
          requireCheckout: true,
          outsideGeofencePolicy: true,
        },
      }),
    ]);
    return {
      items: visits.map(({ publicId, ...visit }) => ({
        id: publicId,
        ...visit,
      })),
      policy: policy ?? {
        defaultRadiusMeters: 150,
        maxAccuracyMeters: 50,
        minimumPhotos: 2,
        retentionDays: 365,
        requireCheckout: true,
        outsideGeofencePolicy: "SUPERVISOR_APPROVAL",
      },
    };
  }

  async create(actor: Actor, casePublicId: string, input: CreateFieldVisitDto) {
    const verificationCase = await this.prisma.verificationCase.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: casePublicId,
        ...(actor.clientId ? { clientId: actor.clientId } : {}),
      },
      select: { id: true, publicId: true, caseNumber: true },
    });
    if (!verificationCase) throw new NotFoundException("Case not found");
    const assignee = await this.prisma.user.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: input.assigneeId,
        status: "ACTIVE",
        userRoles: { some: { role: { code: "FIELD_EXECUTIVE" } } },
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

  async complete(
    actor: Actor,
    visitPublicId: string,
    input: CompleteFieldVisitDto,
  ) {
    const visit = await this.prisma.fieldVisit.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: visitPublicId,
        assigneeId: actor.userId,
      },
      include: {
        evidence: { select: { id: true, capturedAt: true } },
        case: {
          select: { publicId: true, caseNumber: true, assignedOpsUserId: true },
        },
      },
    });
    if (!visit) throw new NotFoundException("Assigned field visit not found");
    if (visit.version !== input.version)
      throw new ConflictException("Visit changed; refresh and try again");
    const policy = await this.prisma.tenantFieldPolicy.findUnique({
      where: { tenantId: actor.tenantId },
      select: {
        maxAccuracyMeters: true,
        minimumPhotos: true,
        outsideGeofencePolicy: true,
        requireCheckout: true,
      },
    });
    const minimumPhotos = policy?.minimumPhotos ?? 2;
    const freshEvidence = visit.evidence.filter(
      (item) => item.capturedAt >= visit.evidenceSince,
    );
    if (freshEvidence.length < minimumPhotos)
      throw new BadRequestException(
        `At least ${minimumPhotos} evidence photos are required`,
      );
    const capturedAt = new Date(input.capturedAt);
    if (
      (policy?.requireCheckout ?? true) &&
      Math.abs(Date.now() - capturedAt.getTime()) > 5 * 60_000
    ) {
      throw new BadRequestException("Capture a fresh location reading");
    }
    const maxAccuracy = policy?.maxAccuracyMeters ?? 50;
    if (input.accuracyMeters > maxAccuracy)
      throw new BadRequestException(
        `GPS accuracy must be ${maxAccuracy} metres or better`,
      );
    if (visit.targetLatitude === null || visit.targetLongitude === null)
      throw new BadRequestException("Visit target location is missing");
    const distance = haversineMeters(
      Number(visit.targetLatitude),
      Number(visit.targetLongitude),
      input.latitude,
      input.longitude,
    );
    const insideFence = distance <= visit.geofenceMeters + input.accuracyMeters;
    if (!insideFence && policy?.outsideGeofencePolicy === "BLOCK") {
      throw new BadRequestException("Visit is outside the allowed geofence");
    }
    const allowAndFlag =
      !insideFence && policy?.outsideGeofencePolicy === "ALLOW_AND_FLAG";
    const status =
      insideFence || allowAndFlag ? "COMPLETED" : "EXCEPTION_REVIEW";

    await this.prisma.$transaction(async (tx) => {
      const result = await tx.fieldVisit.updateMany({
        where: { id: visit.id, version: input.version },
        data: {
          status,
          capturedLatitude: input.latitude,
          capturedLongitude: input.longitude,
          accuracyMeters: input.accuracyMeters,
          distanceMeters: distance,
          capturedAt,
          completedAt: status === "COMPLETED" ? new Date() : null,
          completedById: status === "COMPLETED" ? actor.userId : null,
          checklistJson: JSON.stringify(input.checklist),
          remarks: input.remarks?.trim(),
          version: { increment: 1 },
        },
      });
      if (result.count !== 1)
        throw new ConflictException("Visit was updated concurrently");
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: insideFence
            ? "field_visit.completed"
            : allowAndFlag
              ? "field_visit.completed-outside-geofence"
              : "field_visit.geofence_exception",
          resourceType: "field_visit",
          resourcePublicId: visitPublicId,
          afterJson: JSON.stringify({
            latitude: input.latitude,
            longitude: input.longitude,
            accuracyMeters: input.accuracyMeters,
            distanceMeters: distance,
            status,
          }),
        },
      });
      if (allowAndFlag && visit.case.assignedOpsUserId) {
        await tx.notification.create({
          data: {
            tenantId: actor.tenantId,
            userId: visit.case.assignedOpsUserId,
            type: "FIELD_VISIT_OUTSIDE_GEOFENCE",
            title: "Field visit completed outside geofence",
            body: `${visit.case.caseNumber}: captured ${Math.round(distance)} m from target.`,
            href: `/cases/${visit.case.publicId}`,
          },
        });
      }
    });
    return {
      id: visitPublicId,
      status,
      insideFence,
      distanceMeters: Math.round(distance),
      allowedMeters: visit.geofenceMeters + input.accuracyMeters,
      version: visit.version + 1,
    };
  }

  async reviewException(
    actor: Actor,
    visitPublicId: string,
    input: ReviewFieldExceptionDto,
  ) {
    const visit = await this.prisma.fieldVisit.findFirst({
      where: {
        tenantId: actor.tenantId,
        publicId: visitPublicId,
        status: "EXCEPTION_REVIEW",
        case: {
          ...(actor.clientId ? { clientId: actor.clientId } : {}),
        },
      },
      select: {
        id: true,
        version: true,
        assigneeId: true,
        remarks: true,
        case: { select: { publicId: true, caseNumber: true } },
      },
    });
    if (!visit) throw new NotFoundException("Field exception not found");
    if (visit.version !== input.version) {
      throw new ConflictException("Visit changed; refresh and try again");
    }
    const approved = input.decision === "APPROVE";
    const nextStatus = approved ? "COMPLETED" : "ASSIGNED";
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.fieldVisit.updateMany({
        where: {
          id: visit.id,
          version: input.version,
          status: "EXCEPTION_REVIEW",
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
              remarks:
                input.note?.trim() ||
                "Supervisor requested a new field capture",
              version: { increment: 1 },
            },
      });
      if (updated.count !== 1) {
        throw new ConflictException("Visit was reviewed concurrently");
      }
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: approved
            ? "field_visit.exception-approved"
            : "field_visit.retry-requested",
          resourceType: "field_visit",
          resourcePublicId: visitPublicId,
          beforeJson: JSON.stringify({ status: "EXCEPTION_REVIEW" }),
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
              ? "Field exception approved"
              : "Field visit retry required",
            body: `${visit.case.caseNumber}: ${input.note?.trim() || (approved ? "Supervisor approved the geofence exception." : "Capture fresh location and evidence.")}`,
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
