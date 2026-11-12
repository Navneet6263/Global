import type { Actor } from "../common/auth/actor";
import { notifyClarificationStakeholders } from "../common/persistence/clarification-recipients";
import type { Prisma } from "../generated/prisma/client";

export function isSpocRmOnly(actor: Actor): boolean {
  return (
    actor.roles.includes("SPOC_RM") &&
    !actor.roles.some((r) => ["PLATFORM_ADMIN", "OPS_MANAGER"].includes(r))
  );
}

export async function notifyL2HandoffPeerStakeholders(
  tx: Prisma.TransactionClient,
  actor: Actor,
  input: {
    casePublicId: string;
    caseNumber: string;
    branchId: bigint | null;
    clientId: bigint;
    assignedOpsUserId: bigint | null;
    raisedById: bigint | null;
    subject: string;
    submittedVersion: number;
    deDisplayName: string;
  },
) {
  const actorLabel = isSpocRmOnly(actor) ? `RM (${actor.displayName})` : "Operations";
  await notifyClarificationStakeholders(tx, {
    tenantId: actor.tenantId,
    branchId: input.branchId,
    clientId: input.clientId,
    assignedUserId: input.assignedOpsUserId,
    raisedById: input.raisedById,
    excludeUserId: actor.userId,
    type: "CLARIFICATION_L2_HANDOFF",
    title: "L2 clarification handed off to Data Entry",
    body: `${input.caseNumber}: ${input.subject} (v${input.submittedVersion}) reviewed by ${actorLabel} and sent to ${input.deDisplayName}.`,
    opsHref: "/operations/clarifications",
    rmHref: "/spoc-rm/work?bucket=correction",
  });
}
