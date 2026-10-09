import type { Prisma } from "../generated/prisma/client";
import { queueEmail } from "../common/mail/queue-email";
import type { SecretBoxService } from "../common/security/secret-box.service";
import type { SubjectPiiService } from "../common/security/subject-pii.service";

export type ReleaseMailDeps = {
  secretBox: SecretBoxService;
  pii: SubjectPiiService;
  webOrigin: string;
};

/**
 * "Report Submitted for (candidate, Sapling ID, Emp Code)" email to the company admins
 * once a report is released (process document, report stage).
 */
export async function queueReportReleasedEmails(
  tx: Prisma.TransactionClient,
  deps: ReleaseMailDeps,
  input: {
    tenantId: bigint;
    caseId: bigint;
    reportPublicId: string;
    recipientIds: bigint[];
  },
) {
  if (!input.recipientIds.length) return 0;
  const record = await tx.verificationCase.findUnique({
    where: { id: input.caseId },
    select: {
      caseNumber: true,
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
  if (!record) return 0;
  const employeeCode = deps.pii.open(record.subject).employeeCode ?? "";
  const people = await tx.user.findMany({
    where: { id: { in: input.recipientIds } },
    select: { email: true },
  });
  for (const person of people)
    await queueEmail(tx, deps.secretBox, {
      tenantId: input.tenantId,
      aggregateType: "report",
      aggregateId: input.reportPublicId,
      to: person.email,
      template: "report-released",
      variables: {
        candidateName: record.subject.fullName,
        caseNumber: record.caseNumber,
        employeeCode,
        url: `${deps.webOrigin}/client-portal/reports`,
      },
    });
  return people.length;
}
