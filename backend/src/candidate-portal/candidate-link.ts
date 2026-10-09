import { randomBytes } from "node:crypto";
import type { SecretBoxService } from "../common/security/secret-box.service";
import type { SubjectPiiService } from "../common/security/subject-pii.service";
import type { Prisma } from "../generated/prisma/client";
import {
  digestPortalToken,
  maskDestination,
} from "./candidate-access-authorizer";

export const CANDIDATE_LINK_DAYS = 14;

/**
 * Issue a fresh candidate link: earlier links stop working, a new 14-day link is stored
 * (token hash only) and, when the candidate has contact details, emailed / texted through
 * the outbox. Consent is per case and is never asked again on a new link.
 */
export async function issueCandidateLink(
  tx: Prisma.TransactionClient,
  deps: {
    secretBox: SecretBoxService;
    pii: SubjectPiiService;
    webOrigin: string;
  },
  input: {
    tenantId: bigint;
    caseId: bigint;
    casePublicId: string;
    actorUserId?: bigint;
    subject: Parameters<SubjectPiiService["open"]>[0];
    sendNotification: boolean;
    /** Shown to the candidate when the team asks for something again. */
    reason?: string;
  },
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + CANDIDATE_LINK_DAYS * 86_400_000);
  const destination = deps.pii.open(input.subject);
  const channel = destination.email
    ? "EMAIL"
    : destination.phone
      ? "SMS"
      : undefined;
  const address = destination.email ?? destination.phone;
  await tx.candidatePortalAccess.updateMany({
    where: { caseId: input.caseId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  const created = await tx.candidatePortalAccess.create({
    data: {
      tenantId: input.tenantId,
      caseId: input.caseId,
      tokenHash: digestPortalToken(token),
      expiresAt,
    },
    select: { publicId: true },
  });
  await tx.auditEvent.create({
    data: {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      action: input.reason
        ? "candidate-portal.access-reissued"
        : "candidate-portal.access-issued",
      resourceType: "case",
      resourcePublicId: input.casePublicId,
      afterJson: JSON.stringify({
        accessId: created.publicId,
        expiresAt,
        sendNotification: input.sendNotification,
        ...(input.reason ? { reason: input.reason } : {}),
      }),
    },
  });
  const queued = Boolean(input.sendNotification && channel && address);
  if (queued) {
    await tx.outboxEvent.create({
      data: {
        tenantId: input.tenantId,
        topic: "candidate.access.issued",
        aggregateType: "candidate-portal-access",
        aggregateId: created.publicId,
        payloadJson: JSON.stringify({
          secret: deps.secretBox.seal({
            accessId: created.publicId,
            channel,
            destination: address,
            portalUrl: `${deps.webOrigin}/candidate/${created.publicId}#token=${encodeURIComponent(token)}`,
            expiresAt,
            ...(input.reason ? { reason: input.reason } : {}),
          }),
        }),
      },
    });
  }
  return {
    id: created.publicId,
    token,
    expiresAt,
    delivery: queued
      ? {
          queued: true as const,
          channel: channel!,
          destination: maskDestination(address!, channel!),
        }
      : { queued: false as const },
  };
}
