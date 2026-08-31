import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { CompleteFieldVisitDto } from "./dto/complete-field-visit.dto";
import { haversineMeters } from "./geo";

@Injectable()
export class FieldVisitCompletionService {
  constructor(private readonly prisma: PrismaService) {}

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
        ...(actor.branchId || actor.clientId
          ? {
              case: {
                ...(actor.branchId ? { branchId: actor.branchId } : {}),
                ...(actor.clientId ? { clientId: actor.clientId } : {}),
              },
            }
          : {}),
      },
      include: {
        evidence: { select: { id: true, capturedAt: true } },
        case: {
          select: { publicId: true, caseNumber: true, assignedOpsUserId: true },
        },
      },
    });
    if (!visit) throw new NotFoundException("Assigned field visit not found");
    if (!["ASSIGNED", "IN_PROGRESS"].includes(visit.status)) {
      throw new ConflictException("This visit cannot be completed again");
    }
    if (!visit.checkedInAt) {
      throw new BadRequestException("Check in before completing the visit");
    }
    if (visit.version !== input.version) {
      throw new ConflictException("Visit changed; refresh and try again");
    }

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
    if (freshEvidence.length < minimumPhotos) {
      throw new BadRequestException(
        `At least ${minimumPhotos} evidence photos are required`,
      );
    }
    const capturedAt = new Date(input.capturedAt);
    if (capturedAt < new Date(visit.checkedInAt.getTime() - 5 * 60_000)) {
      throw new BadRequestException("Check-out cannot predate check-in");
    }
    if (capturedAt > new Date(Date.now() + 5 * 60_000)) {
      throw new BadRequestException("Check-out time cannot be in the future");
    }
    if (
      (policy?.requireCheckout ?? true) &&
      Math.abs(Date.now() - capturedAt.getTime()) > 5 * 60_000
    ) {
      throw new BadRequestException("Capture a fresh location reading");
    }
    const maxAccuracy = policy?.maxAccuracyMeters ?? 50;
    if (input.accuracyMeters > maxAccuracy) {
      throw new BadRequestException(
        `GPS accuracy must be ${maxAccuracy} metres or better`,
      );
    }
    if (visit.targetLatitude === null || visit.targetLongitude === null) {
      throw new BadRequestException("Visit target location is missing");
    }

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
        where: {
          id: visit.id,
          version: input.version,
          status: { in: ["ASSIGNED", "IN_PROGRESS"] },
        },
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
      if (result.count !== 1) {
        throw new ConflictException("Visit was updated concurrently");
      }
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
            insideFence,
            distanceBand:
              distance <= visit.geofenceMeters
                ? "WITHIN_TARGET_RADIUS"
                : distance <= visit.geofenceMeters + input.accuracyMeters
                  ? "WITHIN_ACCURACY_ALLOWANCE"
                  : "OUTSIDE_GEOFENCE",
            capturedAt,
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
}
