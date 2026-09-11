import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import type {
  CreatePrivacyRecordDto,
  UpdatePrivacyRecordDto,
} from "./privacy.dto";
import {
  assertPrivacyAdmin,
  incidentSeverities,
  privacyKinds,
  privacyText,
  privacyTrackingNotice,
  privacyTransition,
  requestTypes,
} from "./privacy-policy";

@Injectable()
export class PrivacyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actor: Actor, input: CreatePrivacyRecordDto) {
    assertPrivacyAdmin(actor);
    if (!privacyKinds.includes(input.kind as (typeof privacyKinds)[number]))
      throw new BadRequestException("Choose a privacy record kind");
    const title = privacyText(input.title, "Title", 5, 160);
    const description = privacyText(input.description, "Description", 10, 2000);
    const subjectReference = input.subjectReference?.trim()
      ? privacyText(input.subjectReference, "Subject reference", 3, 200)
      : null;
    if (
      input.kind === "DATA_REQUEST" &&
      (!subjectReference ||
        !requestTypes.includes(
          input.requestType as (typeof requestTypes)[number],
        ))
    ) {
      throw new BadRequestException(
        "Data requests need a request type and a short subject/case reference",
      );
    }
    if (
      input.kind === "INCIDENT" &&
      !incidentSeverities.includes(
        input.severity as (typeof incidentSeverities)[number],
      )
    ) {
      throw new BadRequestException("Incidents need a recorded severity");
    }
    if (
      (input.kind === "DATA_REQUEST" && input.severity) ||
      (input.kind === "INCIDENT" && input.requestType)
    ) {
      throw new BadRequestException(
        "Request types belong to data requests; severity belongs to incidents",
      );
    }
    const dueAt = input.dueAt ? new Date(input.dueAt) : null;
    if (dueAt && !Number.isFinite(dueAt.getTime()))
      throw new BadRequestException("Enter a valid review target date");
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.privacyRecord.create({
        data: {
          tenantId: actor.tenantId,
          kind: input.kind,
          title,
          description,
          subjectReference,
          requestType: input.kind === "DATA_REQUEST" ? input.requestType : null,
          severity: input.kind === "INCIDENT" ? input.severity : null,
          status: input.kind === "DATA_REQUEST" ? "RECEIVED" : "OPEN",
          dueAt,
          createdById: actor.userId,
          updatedById: actor.userId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "privacy.record-created",
          resourceType: "privacy_record",
          resourcePublicId: record.publicId,
          afterJson: JSON.stringify({
            title,
            description,
            kind: record.kind,
            status: record.status,
            requestType: record.requestType,
            subjectReference,
            severity: record.severity,
            version: record.version,
          }),
        },
      });
      return {
        id: record.publicId,
        status: record.status,
        version: record.version,
        trackingNotice: privacyTrackingNotice,
      };
    });
  }

  async update(actor: Actor, publicId: string, input: UpdatePrivacyRecordDto) {
    assertPrivacyAdmin(actor);
    return this.prisma.$transaction(async (tx) => {
      const record = await tx.privacyRecord.findFirst({
        where: { tenantId: actor.tenantId, publicId },
      });
      if (!record) throw new NotFoundException("Privacy record not found");
      if (record.version !== input.version)
        throw new ConflictException(
          "Privacy record changed; refresh before recording a decision",
        );
      const { rationale, reference } = privacyTransition(
        record.kind,
        record.status,
        input.status,
        input.note,
        input.evidenceReference,
      );
      const completedAt = ["FULFILLED", "CLOSED", "REJECTED"].includes(
        input.status,
      )
        ? new Date()
        : null;
      const updated = await tx.privacyRecord.updateMany({
        where: {
          id: record.id,
          tenantId: actor.tenantId,
          version: input.version,
          status: record.status,
        },
        data: {
          status: input.status,
          resolutionNote: rationale,
          evidenceReference: reference ?? record.evidenceReference,
          completedAt,
          updatedById: actor.userId,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          "Privacy record was updated concurrently; refresh",
        );
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "privacy.decision-recorded",
          resourceType: "privacy_record",
          resourcePublicId: publicId,
          beforeJson: JSON.stringify({
            status: record.status,
            note: record.resolutionNote,
            evidenceReference: record.evidenceReference,
            version: record.version,
          }),
          afterJson: JSON.stringify({
            status: input.status,
            note: rationale,
            evidenceReference: reference ?? record.evidenceReference,
            version: input.version + 1,
            completedAt,
            trackingOnly: true,
          }),
        },
      });
      return {
        id: publicId,
        status: input.status,
        version: input.version + 1,
        completedAt,
        trackingNotice: privacyTrackingNotice,
      };
    });
  }
}
