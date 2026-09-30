import type { Prisma } from "../../generated/prisma/client";
import { activeOperationsRecipients } from "../../common/persistence/operations-recipients";
import { documentLabel, type VendorDecision } from "./vendor-rules";

type Tx = Pick<Prisma.TransactionClient, "user" | "notification">;

export interface VendorNoticeContext {
  tenantId: bigint;
  caseNumber: string;
  documentType: string;
  clientName: string;
}

export function notifyVendorAssigned(
  tx: Tx,
  context: VendorNoticeContext,
  vendorUserId: bigint,
  reassigned: boolean,
) {
  return tx.notification.create({
    data: {
      tenantId: context.tenantId,
      userId: vendorUserId,
      type: "VENDOR_REQUEST_ASSIGNED",
      title: reassigned
        ? "Document re-assigned for your review"
        : "New document for your review",
      body: `${context.caseNumber} · ${documentLabel(context.documentType)} from ${context.clientName} is waiting for your decision.`,
      href: "/vendor",
    },
  });
}

/**
 * The SPOC side of a document's vendor chain: every ACTIVE SPOC-RM currently
 * assigned to the client, plus whoever made the assignment while they can still see
 * that client (a Platform Admin, or a SPOC-RM still assigned). One row per user; a
 * SPOC-RM removed from the client receives nothing about it.
 */
export function spocVendorRecipients(
  tx: Pick<Prisma.TransactionClient, "user">,
  tenantId: bigint,
  clientId: bigint,
  assignedById: bigint,
) {
  return tx.user.findMany({
    where: {
      tenantId,
      status: "ACTIVE",
      OR: [
        {
          id: assignedById,
          userRoles: { some: { role: { code: "PLATFORM_ADMIN" } } },
        },
        {
          spocClientScopes: { some: { clientId } },
          userRoles: { some: { role: { code: "SPOC_RM" } } },
        },
      ],
    },
    select: { id: true },
  });
}

export async function notifySpocOfDecision(
  tx: Tx,
  context: VendorNoticeContext & {
    clientId: bigint;
    assignedById: bigint;
    vendorName: string;
    decision: VendorDecision;
    reason: string | null;
  },
) {
  const recipients = await spocVendorRecipients(
    tx,
    context.tenantId,
    context.clientId,
    context.assignedById,
  );
  if (!recipients.length) return;
  const document = `${documentLabel(context.documentType)} for ${context.caseNumber}`;
  const rejected = context.decision === "REJECTED";
  const reason = context.reason ? `: ${context.reason.slice(0, 300)}` : "";
  await tx.notification.createMany({
    data: recipients.map((recipient) => ({
      tenantId: context.tenantId,
      userId: recipient.id,
      type: rejected ? "VENDOR_REQUEST_REJECTED" : "VENDOR_REQUEST_APPROVED",
      title: rejected
        ? "Vendor rejected a document"
        : "Vendor approved a document",
      body: rejected
        ? `${context.vendorName} rejected ${document}${reason}`
        : `${context.vendorName} approved ${document}.`,
      href: "/spoc-rm/vendors",
    })),
  });
}

/**
 * Called inside every document-version write. When the document's latest vendor
 * attempt was rejected and this upload is newer than the rejected file, the SPOC
 * side is told the corrected version is ready to re-assign. Otherwise a no-op.
 */
export async function notifyNewVersionForVendorChain(
  tx: Pick<
    Prisma.TransactionClient,
    "vendorAssignment" | "user" | "notification"
  >,
  input: { tenantId: bigint; documentId: bigint; version: number },
) {
  const latest = await tx.vendorAssignment.findFirst({
    where: { tenantId: input.tenantId, documentId: input.documentId },
    orderBy: { attempt: "desc" },
    select: {
      status: true,
      clientId: true,
      assignedById: true,
      documentVersion: true,
      client: { select: { publicId: true } },
      case: { select: { caseNumber: true } },
      document: { select: { type: true } },
    },
  });
  if (latest?.status !== "REJECTED" || input.version <= latest.documentVersion)
    return;
  const recipients = await spocVendorRecipients(
    tx,
    input.tenantId,
    latest.clientId,
    latest.assignedById,
  );
  if (!recipients.length) return;
  await tx.notification.createMany({
    data: recipients.map((recipient) => ({
      tenantId: input.tenantId,
      userId: recipient.id,
      type: "DOCUMENT_REUPLOAD_RECEIVED",
      title: "New document version ready to re-assign",
      body: `${latest.case.caseNumber} · ${documentLabel(latest.document.type)}: version v${input.version} was uploaded after the vendor rejection.`,
      href: `/spoc-rm/vendors?clientId=${latest.client.publicId}`,
    })),
  });
}

/** Operations learn that a vendor-rejected document went back to the candidate. */
export async function notifyOperationsOfReupload(
  tx: Prisma.TransactionClient,
  context: {
    tenantId: bigint;
    branchId: bigint | null;
    clientId: bigint;
    assignedOpsUserId: bigint | null;
    casePublicId: string;
    caseNumber: string;
    documentType: string;
  },
) {
  const recipients = await activeOperationsRecipients(tx, {
    tenantId: context.tenantId,
    branchId: context.branchId,
    clientId: context.clientId,
    assignedUserId: context.assignedOpsUserId,
  });
  if (!recipients.length) return;
  await tx.notification.createMany({
    data: recipients.map((recipient) => ({
      tenantId: context.tenantId,
      userId: recipient.id,
      type: "DOCUMENT_REUPLOAD_REQUESTED",
      title: "Document re-upload requested",
      body: `${context.caseNumber} · ${documentLabel(context.documentType)}: sent back to the candidate after a vendor rejection.`,
      href: `/cases/${context.casePublicId}`,
    })),
  });
}

/**
 * A vendor attached (or replaced) the report of an approved request: the SPOC side
 * of that client can now preview and download it. Same recipients as decisions.
 */
export async function notifyReportAvailable(
  tx: Tx,
  context: VendorNoticeContext & {
    clientId: bigint;
    clientPublicId: string;
    assignedById: bigint;
    vendorName: string;
    version: number;
  },
) {
  const recipients = await spocVendorRecipients(
    tx,
    context.tenantId,
    context.clientId,
    context.assignedById,
  );
  if (!recipients.length) return;
  await tx.notification.createMany({
    data: recipients.map((recipient) => ({
      tenantId: context.tenantId,
      userId: recipient.id,
      type: "VENDOR_REPORT_AVAILABLE",
      title: "Vendor report available",
      body: `${context.vendorName}: ${context.caseNumber} · ${documentLabel(context.documentType)} (v${context.version}) from ${context.clientName}.`,
      href: `/spoc-rm/vendors?clientId=${context.clientPublicId}`,
    })),
  });
}
