import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import type { Actor } from "../common/auth/actor";
import { caseAccessScope } from "../common/auth/access-scope";
import { PrismaService } from "../database/prisma.service";
import { SubjectPiiService } from "../common/security/subject-pii.service";
import { activeOperationsRecipients } from "../common/persistence/operations-recipients";
import { ConsentIssuanceService } from "./consent-issuance.service";

@Injectable()
export class ConsentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pii: SubjectPiiService,
    private readonly issuance: ConsentIssuanceService,
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
          ...caseAccessScope(actor),
          publicId: casePublicId,
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
    if (["COMPLETED", "CLOSED", "CANCELLED"].includes(consent.case.status)) {
      throw new ConflictException(
        "Consent cannot be reissued for a completed or cancelled case",
      );
    }
    return this.prisma.$transaction((tx) =>
      this.issuance.issue(tx, {
        consentId: consent.id,
        consentPublicId: consent.publicId,
        tenantId: actor.tenantId,
        casePublicId: consent.case.publicId,
        actorUserId: actor.userId,
        email: subjectPii.email,
        phone: subjectPii.phone,
      }),
    );
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
    const actual = Buffer.from(this.issuance.hashOtp(publicId, otp));
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
      const accepted = await tx.consent.updateMany({
        where: {
          id: consent.id,
          status: "REQUESTED",
          otpHash: consent.otpHash,
          otpAttempts: consent.otpAttempts,
          otpExpiresAt: { gt: acceptedAt },
        },
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
      if (accepted.count !== 1) {
        throw new ConflictException(
          "Consent changed while the OTP was being confirmed",
        );
      }
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
      const recipients = await activeOperationsRecipients(tx, {
        tenantId: consent.case.tenantId,
        branchId: consent.case.branchId,
        clientId: consent.case.clientId,
        assignedUserId: consent.case.assignedOpsUserId,
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
}
