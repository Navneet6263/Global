import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type { CheckInFieldVisitDto } from "./dto/check-in-field-visit.dto";

@Injectable()
export class FieldVisitCheckInService {
  constructor(private readonly prisma: PrismaService) {}

  async checkIn(
    actor: Actor,
    visitPublicId: string,
    input: CheckInFieldVisitDto,
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
      select: {
        id: true,
        status: true,
        version: true,
        checkedInAt: true,
        evidenceSince: true,
      },
    });
    if (!visit) throw new NotFoundException("Assigned field visit not found");
    if (!["ASSIGNED", "IN_PROGRESS"].includes(visit.status)) {
      throw new ConflictException(
        "This visit is no longer accepting a check-in",
      );
    }
    if (visit.checkedInAt) {
      return {
        id: visitPublicId,
        status: visit.status,
        checkedInAt: visit.checkedInAt,
        version: visit.version,
      };
    }
    if (visit.version !== input.version) {
      throw new ConflictException("Visit changed; refresh and try again");
    }

    const capturedAt = new Date(input.capturedAt);
    if (capturedAt < new Date(visit.evidenceSince.getTime() - 5 * 60_000)) {
      throw new BadRequestException("Check-in predates this visit attempt");
    }
    if (capturedAt > new Date(Date.now() + 5 * 60_000)) {
      throw new BadRequestException("Check-in time cannot be in the future");
    }
    const policy = await this.prisma.tenantFieldPolicy.findUnique({
      where: { tenantId: actor.tenantId },
      select: { maxAccuracyMeters: true },
    });
    const maxAccuracy = policy?.maxAccuracyMeters ?? 50;
    if (input.accuracyMeters > maxAccuracy) {
      throw new BadRequestException(
        `GPS accuracy must be ${maxAccuracy} metres or better`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.fieldVisit.updateMany({
        where: {
          id: visit.id,
          version: input.version,
          status: { in: ["ASSIGNED", "IN_PROGRESS"] },
        },
        data: {
          status: "IN_PROGRESS",
          checkInLatitude: input.latitude,
          checkInLongitude: input.longitude,
          checkInAccuracy: input.accuracyMeters,
          checkedInAt: capturedAt,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException("Visit was updated concurrently");
      }
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "field_visit.checked-in",
          resourceType: "field_visit",
          resourcePublicId: visitPublicId,
          afterJson: JSON.stringify({
            accuracyBand:
              input.accuracyMeters <= 10
                ? "HIGH"
                : input.accuracyMeters <= 30
                  ? "MEDIUM"
                  : "LOW",
            capturedAt,
          }),
        },
      });
    });
    return {
      id: visitPublicId,
      status: "IN_PROGRESS",
      checkedInAt: capturedAt,
      version: visit.version + 1,
    };
  }
}
