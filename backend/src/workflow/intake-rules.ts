import { effectiveRole } from "../common/auth/role-filter";
import type { Prisma } from "../generated/prisma/client";

type Tx = Prisma.TransactionClient;

const caseForRules = {
  id: true,
  publicId: true,
  caseNumber: true,
  tenantId: true,
  status: true,
  version: true,
  workflowVersion: true,
  intakeStage: true,
  assignedOpsUserId: true,
  dataEntryUserId: true,
  subject: { select: { fullName: true } },
  client: {
    select: {
      id: true,
      displayName: true,
      clientReviewFirst: true,
      defaultDataEntryUser: {
        select: {
          id: true,
          publicId: true,
          displayName: true,
          status: true,
          userRoles: {
            select: { role: { select: { code: true, baseRoleCode: true } } },
          },
        },
      },
    },
  },
} satisfies Prisma.VerificationCaseSelect;

type RuleCase = Prisma.VerificationCaseGetPayload<{
  select: typeof caseForRules;
}>;

export type IntakeRuleResult =
  "client-review" | "client-review-again" | "auto-data-entry" | "none";

/**
 * Runs when the candidate presses Complete (BGV process, intake routing):
 * Route A — the client reviews the submission first; Route B — straight to Sapling,
 * where the client's auto-assignment rule (if any) hands it to its Data Entry user.
 * Every change is audited; nothing happens for cases outside the v2 intake.
 */
export async function applyIntakeRules(
  tx: Tx,
  caseId: bigint,
): Promise<IntakeRuleResult> {
  const item = await tx.verificationCase.findUniqueOrThrow({
    where: { id: caseId },
    select: caseForRules,
  });
  if (item.workflowVersion !== 2 || item.status !== "DOCUMENT_PENDING")
    return "none";
  if (item.intakeStage === "CLIENT_RETURNED") {
    await moveStage(
      tx,
      item,
      "CLIENT_REVIEW",
      "case.client-review-resubmitted",
    );
    await notifyClientAdmins(tx, item, true);
    return "client-review-again";
  }
  if (item.intakeStage !== "INTAKE") return "none";
  if (item.client.clientReviewFirst) {
    await moveStage(tx, item, "CLIENT_REVIEW", "case.client-review-requested");
    await notifyClientAdmins(tx, item, false);
    return "client-review";
  }
  return (await autoAssignDataEntry(tx, item)) ? "auto-data-entry" : "none";
}

/** After the client approves (Route A), the same auto-assignment rule applies. */
export async function applyAutoAssignment(tx: Tx, caseId: bigint) {
  const item = await tx.verificationCase.findUniqueOrThrow({
    where: { id: caseId },
    select: caseForRules,
  });
  return autoAssignDataEntry(tx, item);
}

async function autoAssignDataEntry(tx: Tx, item: RuleCase) {
  const user = item.client.defaultDataEntryUser;
  if (
    !user ||
    user.status !== "ACTIVE" ||
    !user.userRoles.some((row) => effectiveRole(row.role) === "DATA_ENTRY") ||
    !item.assignedOpsUserId ||
    item.dataEntryUserId ||
    item.intakeStage !== "INTAKE"
  )
    return false;
  const updated = await tx.verificationCase.updateMany({
    where: {
      id: item.id,
      version: item.version,
      intakeStage: "INTAKE",
      dataEntryUserId: null,
    },
    data: {
      dataEntryUserId: user.id,
      dataEntryAssignedAt: new Date(),
      intakeStage: "DATA_ENTRY",
      version: { increment: 1 },
    },
  });
  if (updated.count !== 1) return false;
  await tx.auditEvent.create({
    data: {
      tenantId: item.tenantId,
      action: "case.data-entry-assigned",
      resourceType: "case",
      resourcePublicId: item.publicId,
      beforeJson: JSON.stringify({
        intakeStage: "INTAKE",
        version: item.version,
      }),
      afterJson: JSON.stringify({
        caseNumber: item.caseNumber,
        dataEntryUserId: user.publicId,
        dataEntryUserName: user.displayName,
        intakeStage: "DATA_ENTRY",
        auto: true,
        rule: `Default Data Entry for ${item.client.displayName}`,
      }),
    },
  });
  await tx.notification.createMany({
    data: [
      {
        tenantId: item.tenantId,
        userId: user.id,
        type: "DATA_ENTRY_ASSIGNED",
        title: "Case assigned for Data Entry",
        body: `${item.caseNumber}: assigned automatically by the ${item.client.displayName} rule.`,
        href: `/data-entry?caseId=${item.publicId}`,
      },
      {
        tenantId: item.tenantId,
        userId: item.assignedOpsUserId,
        type: "DATA_ENTRY_ASSIGNED",
        title: "Data Entry assigned automatically",
        body: `${item.caseNumber} went to ${user.displayName} (client rule).`,
        href: `/spoc-rm/work?caseId=${item.publicId}`,
      },
    ],
  });
  return true;
}

async function moveStage(
  tx: Tx,
  item: RuleCase,
  stage: string,
  action: string,
) {
  await tx.verificationCase.update({
    where: { id: item.id },
    data: { intakeStage: stage, version: { increment: 1 } },
  });
  await tx.auditEvent.create({
    data: {
      tenantId: item.tenantId,
      action,
      resourceType: "case",
      resourcePublicId: item.publicId,
      beforeJson: JSON.stringify({ intakeStage: item.intakeStage }),
      afterJson: JSON.stringify({
        caseNumber: item.caseNumber,
        intakeStage: stage,
      }),
    },
  });
}

async function notifyClientAdmins(tx: Tx, item: RuleCase, again: boolean) {
  const admins = await tx.user.findMany({
    where: {
      tenantId: item.tenantId,
      clientId: item.client.id,
      status: "ACTIVE",
      userRoles: { some: { role: { code: "CLIENT_ADMIN" } } },
    },
    select: { id: true },
  });
  if (admins.length)
    await tx.notification.createMany({
      data: admins.map((admin) => ({
        tenantId: item.tenantId,
        userId: admin.id,
        type: "CLIENT_REVIEW_REQUESTED",
        title: again
          ? "Resubmitted: review the candidate's documents"
          : "Review the candidate's documents",
        body: `${item.caseNumber}: ${item.subject.fullName} submitted documents. Approve to start verification.`,
        href: "/client-portal/review",
      })),
    });
}
