import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomInt } from "node:crypto";
import { SecretBoxService } from "../common/security/secret-box.service";
import type { SubjectPiiService } from "../common/security/subject-pii.service";
import type { Prisma } from "../generated/prisma/client";

export type ConsentIssueTarget = {
  consentId: bigint;
  consentPublicId: string;
  tenantId: bigint;
  casePublicId: string;
  /** Absent when the candidate asked for the code themselves. */
  actorUserId?: bigint;
  email?: string;
  phone?: string;
  /**
   * The candidate asked for the code inside their single secure link: it goes to email
   * first and carries no separate consent link.
   */
  inPortal?: boolean;
};

@Injectable()
export class ConsentIssuanceService {
  constructor(
    private readonly config: ConfigService,
    private readonly secretBox: SecretBoxService,
  ) {}

  async issue(tx: Prisma.TransactionClient, target: ConsentIssueTarget) {
    const channel: "EMAIL" | "SMS" = target.inPortal
      ? target.email
        ? "EMAIL"
        : "SMS"
      : target.phone
        ? "SMS"
        : "EMAIL";
    const destination = channel === "EMAIL" ? target.email : target.phone;
    if (!destination) {
      throw new BadRequestException(
        "A candidate email or mobile number is required for consent delivery",
      );
    }

    const resendAvailableBefore = new Date(Date.now() - 60_000);
    const otp = randomInt(100_000, 1_000_000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    const issuedAt = new Date();
    const issued = await tx.consent.updateMany({
      where: {
        id: target.consentId,
        OR: [
          { otpLastIssuedAt: null },
          { otpLastIssuedAt: { lte: resendAvailableBefore } },
        ],
      },
      data: {
        otpHash: this.hashOtp(target.consentPublicId, otp),
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
        consentId: target.consentId,
        eventType: "OTP_ISSUED",
        evidenceJson: JSON.stringify({ expiresAt }),
      },
    });
    await tx.outboxEvent.updateMany({
      where: {
        tenantId: target.tenantId,
        topic: "consent.otp.requested",
        aggregateId: target.consentPublicId,
        status: { in: ["PENDING", "RETRY"] },
      },
      data: { status: "PROCESSED", processedAt: issuedAt, payloadJson: "{}" },
    });
    await tx.outboxEvent.create({
      data: {
        tenantId: target.tenantId,
        topic: "consent.otp.requested",
        aggregateType: "consent",
        aggregateId: target.consentPublicId,
        payloadJson: JSON.stringify({
          consentId: target.consentPublicId,
          secret: this.secretBox.seal({
            channel,
            destination,
            otp,
            ...(target.inPortal
              ? {}
              : {
                  consentUrl: `${this.config.getOrThrow<string>("WEB_ORIGIN")}/consent/${target.consentPublicId}`,
                }),
            expiresAt,
            issuedAt,
          }),
        }),
      },
    });
    await tx.auditEvent.create({
      data: {
        tenantId: target.tenantId,
        actorUserId: target.actorUserId,
        action: "consent.otp-requested",
        resourceType: "consent",
        resourcePublicId: target.consentPublicId,
        afterJson: JSON.stringify({
          expiresAt,
          ...(target.inPortal ? { via: "candidate-link" } : {}),
        }),
      },
    });

    return {
      consentId: target.consentPublicId,
      expiresAt,
      ...(this.config.get("NODE_ENV") === "development"
        ? { developmentOtp: otp }
        : {}),
    };
  }

  /** What the single candidate link needs to be issued and delivered. */
  candidateLinkDeps(pii: SubjectPiiService) {
    return {
      secretBox: this.secretBox,
      pii,
      webOrigin: this.config.getOrThrow<string>("WEB_ORIGIN"),
    };
  }

  hashOtp(publicId: string, otp: string): string {
    return createHmac(
      "sha256",
      this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
    )
      .update(`${publicId}:${otp}`)
      .digest("hex");
  }

  async receipt(
    tx: Prisma.TransactionClient,
    target: {
      tenantId: bigint;
      consentId: string;
      email?: string;
      phone?: string;
      caseNumber: string;
      purpose: string;
      noticeVersion: string;
      acceptedAt: Date;
    },
  ) {
    const destination = target.email ?? target.phone;
    if (!destination) return;
    await tx.outboxEvent.create({
      data: {
        tenantId: target.tenantId,
        topic: "notification.requested",
        aggregateType: "consent",
        aggregateId: target.consentId,
        payloadJson: JSON.stringify({
          secret: this.secretBox.seal({
            channel: target.email ? "EMAIL" : "SMS",
            destination,
            template: "candidate-consent-receipt",
            variables: {
              caseNumber: target.caseNumber,
              purpose: target.purpose,
              noticeVersion: target.noticeVersion,
              acceptedAt: target.acceptedAt,
            },
          }),
        }),
      },
    });
  }
}
