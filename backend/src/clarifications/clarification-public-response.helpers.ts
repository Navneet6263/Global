import { ConflictException } from "@nestjs/common";
import { notifyClarificationStakeholders } from "../common/persistence/clarification-recipients";
import type { PrismaService } from "../database/prisma.service";
import type { ClarificationTokenService } from "./clarification-token.service";

export async function getPublicClarification(
  tokens: ClarificationTokenService,
  publicId: string,
  token: string,
) {
  const clarification = await tokens.authorize(publicId, token);
  return {
    id: clarification.publicId,
    status: clarification.status,
    subject: clarification.subject,
    dueAt: clarification.dueAt,
    caseNumber: clarification.case.caseNumber,
    messages: clarification.messages.map(({ senderType, body, createdAt }) => ({
      sender: senderType,
      body,
      createdAt,
    })),
  };
}

export async function respondToPublicClarification(
  prisma: PrismaService,
  tokens: ClarificationTokenService,
  publicId: string,
  token: string,
  body: string,
) {
  const clarification = await tokens.authorize(publicId, token);
  if (
    "requestedDocumentType" in clarification &&
    clarification.requestedDocumentType
  ) {
    throw new ConflictException(
      "Upload the requested corrected document using your candidate portal link",
    );
  }
  const respondedAt = new Date();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.clarification.updateMany({
      where: {
        id: clarification.id,
        status: "OPEN",
        responseTokenHash: clarification.responseTokenHash,
      },
      data: {
        status: "RESPONDED",
        responseTokenHash: null,
        responseTokenExpiresAt: null,
      },
    });
    if (updated.count !== 1) {
      throw new ConflictException(
        "Clarification changed; refresh before responding again",
      );
    }
    await tx.clarificationMessage.create({
      data: {
        clarificationId: clarification.id,
        senderType: "CANDIDATE",
        body: body.trim(),
      },
    });
    await tx.outboxEvent.create({
      data: {
        tenantId: clarification.tenantId,
        topic: "clarification.responded",
        aggregateType: "clarification",
        aggregateId: publicId,
        payloadJson: JSON.stringify({
          clarificationId: publicId,
          respondedAt,
        }),
      },
    });
    await notifyClarificationStakeholders(tx, {
      tenantId: clarification.tenantId,
      branchId: clarification.case.branchId,
      clientId: clarification.case.clientId,
      assignedUserId: clarification.case.assignedOpsUserId,
      type: "CLARIFICATION_RESPONDED",
      title: "Candidate response received",
      body: `${clarification.case.caseNumber}: ${clarification.subject}`,
      opsHref: `/operations/clarifications`,
      rmHref: `/spoc-rm/work?bucket=correction`,
    });
    await tx.auditEvent.create({
      data: {
        tenantId: clarification.tenantId,
        action: "clarification.candidate-responded",
        resourceType: "clarification",
        resourcePublicId: publicId,
        afterJson: JSON.stringify({ status: "RESPONDED", respondedAt }),
      },
    });
  });
  return { received: true, respondedAt };
}
