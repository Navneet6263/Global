import type { Prisma } from "../../generated/prisma/client";
import { documentLabel } from "./vendor-rules";

type Tx = Pick<Prisma.TransactionClient, "notification">;

interface RequestNotice {
  tenantId: bigint;
  caseNumber: string;
  documentType: string;
  clientName: string;
  ownerName: string;
}

/** The team user now holds a request delegated by its Main Vendor. */
export function notifyDelegated(
  tx: Tx,
  handlerUserId: bigint,
  notice: RequestNotice,
) {
  return tx.notification.create({
    data: {
      tenantId: notice.tenantId,
      userId: handlerUserId,
      type: "VENDOR_REQUEST_DELEGATED",
      title: "Document assigned to you",
      body: `${notice.ownerName} asked you to review ${notice.caseNumber} · ${documentLabel(notice.documentType)} from ${notice.clientName}.`,
      href: "/vendor",
    },
  });
}

/** A reminder from the Main Vendor to finish a delegated request. */
export function notifyReminder(
  tx: Tx,
  handlerUserId: bigint,
  notice: RequestNotice,
) {
  return tx.notification.create({
    data: {
      tenantId: notice.tenantId,
      userId: handlerUserId,
      type: "VENDOR_REQUEST_REMINDER",
      title: "Reminder: review waiting",
      body: `${notice.ownerName} is waiting for your decision on ${notice.caseNumber} · ${documentLabel(notice.documentType)}.`,
      href: "/vendor",
    },
  });
}

/** A suspended or removed team user's pending requests went back to the Main Vendor. */
export function notifyDelegationsReturned(
  tx: Tx,
  input: {
    tenantId: bigint;
    ownerId: bigint;
    memberName: string;
    count: number;
  },
) {
  return tx.notification.create({
    data: {
      tenantId: input.tenantId,
      userId: input.ownerId,
      type: "VENDOR_REQUESTS_RETURNED",
      title: "Requests returned to you",
      body: `${input.count} pending request${input.count === 1 ? "" : "s"} held by ${input.memberName} came back to you.`,
      href: "/vendor",
    },
  });
}
