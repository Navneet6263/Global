import { issueCandidateLink } from "../candidate-portal/candidate-link";
import { queueEmail } from "../common/mail/queue-email";
import type { SecretBoxService } from "../common/security/secret-box.service";
import type { SubjectPiiService } from "../common/security/subject-pii.service";
import type { Prisma } from "../generated/prisma/client";

export interface InsufficiencyDeps {
  secretBox: SecretBoxService;
  pii: SubjectPiiService;
  webOrigin: string;
}

/**
 * L1 / L2 insufficiency notice (BGV process: "raised with remarks and Auto Notification to
 * Candidate / Client"). The candidate gets a fresh secure link with the reason; every
 * active company admin gets an in-app notice and an email. `reminder` > 0 marks the
 * 24-hour re-alert. Returns whether the candidate could be reached.
 */
export async function sendInsufficiencyNotice(
  tx: Prisma.TransactionClient,
  deps: InsufficiencyDeps,
  input: {
    tenantId: bigint;
    caseId: bigint;
    actorUserId?: bigint;
    subject: string;
    message: string;
    reminder?: number;
    /** L1 = intake, L2 = raised during verification. */
    level?: "L1" | "L2";
  },
) {
  const record = await tx.verificationCase.findUniqueOrThrow({
    where: { id: input.caseId },
    select: {
      publicId: true,
      caseNumber: true,
      clientId: true,
      subject: {
        select: {
          fullName: true,
          email: true,
          phone: true,
          employeeCode: true,
          piiCiphertext: true,
          piiKeyVersion: true,
        },
      },
    },
  });
  const reminder = input.reminder ?? 0;
  const prefix = reminder
    ? "Reminder — information still needed"
    : "Information needed";
  const link = await issueCandidateLink(tx, deps, {
    tenantId: input.tenantId,
    caseId: input.caseId,
    casePublicId: record.publicId,
    actorUserId: input.actorUserId,
    subject: record.subject,
    sendNotification: true,
    reason: `${prefix}: ${input.subject}. ${input.message}`.slice(0, 900),
  });
  const admins = await tx.user.findMany({
    where: {
      tenantId: input.tenantId,
      clientId: record.clientId,
      status: "ACTIVE",
      userRoles: { some: { role: { code: "CLIENT_ADMIN" } } },
    },
    select: { id: true, email: true },
  });
  if (admins.length) {
    await tx.notification.createMany({
      data: admins.map((admin) => ({
        tenantId: input.tenantId,
        userId: admin.id,
        type: "INSUFFICIENCY_RAISED",
        title: reminder
          ? `Reminder: information still needed for ${record.caseNumber}`
          : `Information needed for ${record.caseNumber}`,
        body: `${record.subject.fullName}: ${input.subject}`.slice(0, 1000),
        href: "/client-portal/actions",
      })),
    });
    for (const admin of admins)
      await queueEmail(tx, deps.secretBox, {
        tenantId: input.tenantId,
        aggregateType: "case",
        aggregateId: record.publicId,
        to: admin.email,
        template: "insufficiency",
        variables: {
          caseNumber: record.caseNumber,
          candidateName: record.subject.fullName,
          subject: input.subject,
          message: input.message,
          reminder,
          level: input.level ?? "L1",
          url: `${deps.webOrigin}/client-portal/actions`,
        },
      });
  }
  return {
    candidateReached: link.delivery.queued,
    clientAdmins: admins.length,
  };
}
