import { ConflictException, Injectable } from "@nestjs/common";
import { SubjectPiiService } from "../common/security/subject-pii.service";
import { ConsentIssuanceService } from "../consents/consent-issuance.service";
import { ConsentsService } from "../consents/consents.service";
import { PrismaService } from "../database/prisma.service";
import {
  authorizeCandidateAccess,
  maskDestination,
} from "./candidate-access-authorizer";

/**
 * Consent inside the single candidate link: the candidate asks for a one-time code
 * (emailed, with no separate consent link), enters it on the same page, and uploads
 * open. Consent is per case and recorded once; a later link never asks again.
 */
@Injectable()
export class CandidateConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pii: SubjectPiiService,
    private readonly issuance: ConsentIssuanceService,
    private readonly consents: ConsentsService,
  ) {}

  async sendOtp(accessPublicId: string, token: string) {
    const { access, consent } = await this.pending(accessPublicId, token);
    const subject = await this.prisma.subject.findUniqueOrThrow({
      where: { id: access.case.subjectId },
      select: {
        email: true,
        phone: true,
        employeeCode: true,
        piiCiphertext: true,
        piiKeyVersion: true,
      },
    });
    const contact = this.pii.open(subject);
    const issued = await this.prisma.$transaction((tx) =>
      this.issuance.issue(tx, {
        consentId: consent.id,
        consentPublicId: consent.publicId,
        tenantId: access.tenantId,
        casePublicId: access.case.publicId,
        email: contact.email,
        phone: contact.phone,
        inPortal: true,
      }),
    );
    return {
      sent: true,
      expiresAt: issued.expiresAt,
      destination: contact.email
        ? maskDestination(contact.email, "EMAIL")
        : maskDestination(contact.phone ?? "", "SMS"),
      ...(issued.developmentOtp
        ? { developmentOtp: issued.developmentOtp }
        : {}),
    };
  }

  async confirm(
    accessPublicId: string,
    token: string,
    otp: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const { consent } = await this.pending(accessPublicId, token, true);
    return this.consents.confirm(consent.publicId, otp, ipAddress, userAgent);
  }

  private async pending(
    accessPublicId: string,
    token: string,
    allowAccepted = false,
  ) {
    const access = await authorizeCandidateAccess(
      this.prisma,
      accessPublicId,
      token,
    );
    const consent = await this.prisma.consent.findFirst({
      where: { caseId: access.caseId },
      orderBy: { createdAt: "desc" },
      select: { id: true, publicId: true, status: true },
    });
    if (!consent)
      throw new ConflictException("No consent is requested for this case");
    if (consent.status === "WITHDRAWN")
      throw new ConflictException(
        "Consent was withdrawn. Contact the verification team.",
      );
    if (consent.status === "ACCEPTED" && !allowAccepted)
      throw new ConflictException("Your consent is already recorded");
    return { access, consent };
  }
}
