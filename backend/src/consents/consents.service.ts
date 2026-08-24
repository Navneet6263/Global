import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import type { Actor } from "../common/auth/actor";
import { PrismaService } from "../database/prisma.service";
import { SecretBoxService } from "../common/security/secret-box.service";
import { SubjectPiiService } from "../common/security/subject-pii.service";

@Injectable()
export class ConsentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly secretBox: SecretBoxService,
    private readonly pii: SubjectPiiService,
  ) {}

  async getPublic(publicId: string) {
    const consent = await this.prisma.consent.findUnique({
      where: { publicId },
      select: {
        publicId: true,
        status: true,
        purpose: true,
        noticeVersion: true,
        acceptedAt: true,
        withdrawnAt: true,
        case: {
          select: {
            caseNumber: true,
            subject: { select: { fullName: true } },
            client: { select: { displayName: true } },
          },
        },
      },
    });
    if (!consent) throw new NotFoundException("Consent request not found");
    return {
      id: consent.publicId,
      status: consent.status,
      purpose: consent.purpose,
      noticeVersion: consent.noticeVersion,
      acceptedAt: consent.acceptedAt,
      withdrawnAt: consent.withdrawnAt,
      caseNumber: consent.case.caseNumber,
      candidateName: consent.case.subject.fullName,
      requestedBy: consent.case.client.displayName,
    };
  }

  async request(actor: Actor, casePublicId: string) {
    const consent = await this.prisma.consent.findFirst({
      where: {
        case: {
          publicId: casePublicId,
          tenantId: actor.tenantId,
          ...(actor.clientId ? { clientId: actor.clientId } : {}),
        },
      },
      include: { case: { include: { subject: true } } },
      orderBy: { createdAt: "desc" },
    });
    if (!consent) throw new NotFoundException("Consent request not found");
    const subjectPii = this.pii.open(consent.case.subject);
    if (["ACCEPTED", "WITHDRAWN"].includes(consent.status)) {
      throw new BadRequestException(
        `Consent is already ${consent.status.toLowerCase()}`,
      );
    }
    const resendAvailableBefore = new Date(Date.now() - 60_000);
    if (
      consent.otpLastIssuedAt &&
      consent.otpLastIssuedAt > resendAvailableBefore
    ) {
      throw new BadRequestException(
        "Wait 60 seconds before requesting another OTP",
      );
    }

    const otp = randomInt(100_000, 1_000_000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    const issuedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      const issued = await tx.consent.updateMany({
        where: {
          id: consent.id,
          OR: [
            { otpLastIssuedAt: null },
            { otpLastIssuedAt: { lte: resendAvailableBefore } },
          ],
        },
        data: {
          otpHash: this.hashOtp(consent.publicId, otp),
          otpExpiresAt: expiresAt,
          otpAttempts: 0,
          otpLastIssuedAt: issuedAt,
          status: "REQUESTED",
        },
      });
      if (issued.count !== 1) {
        throw new BadRequestException(
          "Wait 60 seconds before requesting another OTP",
        );
      }
      await tx.consentEvent.create({
        data: {
          consentId: consent.id,
          eventType: "OTP_ISSUED",
          evidenceJson: JSON.stringify({ expiresAt }),
        },
      });
      await tx.outboxEvent.create({
        data: {
          tenantId: actor.tenantId,
          topic: "consent.otp.requested",
          aggregateType: "consent",
          aggregateId: consent.publicId,
          payloadJson: JSON.stringify({
            consentId: consent.publicId,
            secret: this.secretBox.seal({
              channel: subjectPii.phone ? "SMS" : "EMAIL",
              destination: subjectPii.phone ?? subjectPii.email ?? null,
              otp,
              consentUrl: `${this.config.getOrThrow<string>("WEB_ORIGIN")}/consent/${consent.publicId}`,
              expiresAt,
            }),
          }),
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: actor.tenantId,
          actorUserId: actor.userId,
          action: "consent.otp-requested",
          resourceType: "consent",
          resourcePublicId: consent.publicId,
          afterJson: JSON.stringify({ expiresAt }),
        },
      });
    });
    return {
      consentId: consent.publicId,
      expiresAt,
      ...(this.config.get("NODE_ENV") === "development"
        ? { developmentOtp: otp }
        : {}),
    };
  }

  async confirm(
    publicId: string,
    otp: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const consent = await this.prisma.consent.findUnique({
      where: { publicId },
      include: { case: true },
    });
    if (!consent) throw new NotFoundException("Consent request not found");
    if (consent.status === "ACCEPTED")
      return { accepted: true, acceptedAt: consent.acceptedAt };
    if (
      !consent.otpHash ||
      !consent.otpExpiresAt ||
      consent.otpExpiresAt <= new Date() ||
      consent.otpAttempts >= 5
    ) {
      throw new UnauthorizedException("OTP is invalid or expired");
    }
    const actual = Buffer.from(this.hashOtp(publicId, otp));
    const expected = Buffer.from(consent.otpHash);
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      const attempts = consent.otpAttempts + 1;
      await this.prisma.$transaction(async (tx) => {
        const failed = await tx.consent.updateMany({
          where: { id: consent.id, otpAttempts: consent.otpAttempts },
          data: {
            otpAttempts: { increment: 1 },
            ...(attempts >= 5 ? { otpHash: null, otpExpiresAt: null } : {}),
          },
        });
        if (failed.count === 1) {
          await tx.consentEvent.create({
            data: {
              consentId: consent.id,
              eventType: "OTP_FAILED",
              evidenceJson: JSON.stringify({ attempts, ipAddress }),
            },
          });
        }
      });
      throw new UnauthorizedException("OTP is invalid or expired");
    }

    const acceptedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.consent.update({
        where: { id: consent.id },
        data: {
          status: "ACCEPTED",
          acceptedAt,
          ipAddress: ipAddress?.slice(0, 64),
          userAgent: userAgent?.slice(0, 500),
          otpHash: null,
          otpExpiresAt: null,
          otpAttempts: 0,
        },
      });
      await tx.consentEvent.create({
        data: {
          consentId: consent.id,
          eventType: "ACCEPTED",
          evidenceJson: JSON.stringify({
            acceptedAt,
            ipAddress,
            noticeVersion: consent.noticeVersion,
          }),
        },
      });
      if (consent.case.status === "CONSENT_PENDING") {
        await tx.verificationCase.update({
          where: { id: consent.caseId },
          data: { status: "DOCUMENT_PENDING", version: { increment: 1 } },
        });
        await tx.caseStatusHistory.create({
          data: {
            caseId: consent.caseId,
            fromStatus: "CONSENT_PENDING",
            toStatus: "DOCUMENT_PENDING",
            reason: "Candidate consent accepted",
          },
        });
      }
      await tx.outboxEvent.create({
        data: {
          tenantId: consent.case.tenantId,
          topic: "consent.accepted",
          aggregateType: "case",
          aggregateId: consent.case.publicId,
          payloadJson: JSON.stringify({ caseId: consent.case.publicId }),
        },
      });
      const recipients = consent.case.assignedOpsUserId
        ? [{ id: consent.case.assignedOpsUserId }]
        : await tx.user.findMany({
            where: {
              tenantId: consent.case.tenantId,
              status: "ACTIVE",
              userRoles: { some: { role: { code: "OPS_MANAGER" } } },
            },
            select: { id: true },
          });
      if (recipients.length) {
        await tx.notification.createMany({
          data: recipients.map((recipient) => ({
            tenantId: consent.case.tenantId,
            userId: recipient.id,
            type: "CONSENT_ACCEPTED",
            title: "Candidate consent received",
            body: `${consent.case.caseNumber} can proceed to verification.`,
            href: `/cases/${consent.case.publicId}`,
          })),
        });
      }
      await tx.auditEvent.create({
        data: {
          tenantId: consent.case.tenantId,
          action: "consent.accepted",
          resourceType: "consent",
          resourcePublicId: consent.publicId,
          afterJson: JSON.stringify({
            acceptedAt,
            noticeVersion: consent.noticeVersion,
          }),
        },
      });
    });
    return { accepted: true, acceptedAt };
  }

  private hashOtp(publicId: string, otp: string): string {
    return createHmac(
      "sha256",
      this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
    )
      .update(`${publicId}:${otp}`)
      .digest("hex");
  }
}
