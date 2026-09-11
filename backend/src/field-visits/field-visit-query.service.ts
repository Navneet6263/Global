import { Injectable } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";

const mineSelect = {
  publicId: true,
  status: true,
  address: true,
  targetLatitude: true,
  targetLongitude: true,
  geofenceMeters: true,
  capturedAt: true,
  checkedInAt: true,
  checkInLatitude: true,
  checkInLongitude: true,
  checkInAccuracy: true,
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
    select: { publicId: true, type: true, capturedAt: true, createdAt: true },
  },
} as const;

export function mergeFieldVisitQueue<T>(active: T[], recentCompleted: T[]) {
  return [...active, ...recentCompleted];
}

@Injectable()
export class FieldVisitQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async mine(actor: Actor) {
    const scope = {
      tenantId: actor.tenantId,
      assigneeId: actor.userId,
      ...(actor.branchId || actor.clientId
        ? {
            case: {
              ...(actor.branchId ? { branchId: actor.branchId } : {}),
              ...(actor.clientId ? { clientId: actor.clientId } : {}),
            },
          }
        : {}),
    };
    const [active, recentCompleted, policy] = await Promise.all([
      this.prisma.fieldVisit.findMany({
        where: {
          ...scope,
          status: {
            in: [
              "ASSIGNED",
              "IN_PROGRESS",
              "EXCEPTION_REVIEW",
              "REVIEW_PENDING",
            ],
          },
        },
        select: mineSelect,
        orderBy: { createdAt: "asc" },
      }),
      this.prisma.fieldVisit.findMany({
        where: { ...scope, status: "COMPLETED" },
        select: mineSelect,
        orderBy: { completedAt: "desc" },
        take: 30,
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
    const visits = mergeFieldVisitQueue(active, recentCompleted);
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
}
