import type { Prisma } from "../../generated/prisma/client";

type Tx = Pick<Prisma.TransactionClient, "user" | "notification">;

/** A new request goes to every ACTIVE Support Agent of the tenant (one shared inbox). */
export async function notifySupportAgents(
  tx: Tx,
  input: {
    tenantId: bigint;
    requestPublicId: string;
    requestNumber: string;
    subject: string;
    clientName: string;
    requesterLabel: string;
  },
) {
  const agents = await tx.user.findMany({
    where: {
      tenantId: input.tenantId,
      status: "ACTIVE",
      userRoles: { some: { role: { code: "SUPPORT_AGENT" } } },
    },
    select: { id: true },
  });
  if (!agents.length) return;
  await tx.notification.createMany({
    data: agents.map((agent) => ({
      tenantId: input.tenantId,
      userId: agent.id,
      type: "SUPPORT_REQUEST_CREATED",
      title: "New support request",
      body: `${input.requestNumber} from ${input.requesterLabel} (${input.clientName}): ${input.subject.slice(0, 200)}`,
      href: `/support/requests?requestId=${input.requestPublicId}`,
    })),
  });
}

/** The Client Admin who raised a request hears when it is taken or resolved. */
export function notifySupportRequester(
  tx: Pick<Prisma.TransactionClient, "notification">,
  input: {
    tenantId: bigint;
    userId: bigint;
    requestNumber: string;
    status: "IN_PROGRESS" | "RESOLVED";
  },
) {
  const resolved = input.status === "RESOLVED";
  return tx.notification.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      type: "SUPPORT_REQUEST_UPDATED",
      title: resolved
        ? "Support request resolved"
        : "Support request in progress",
      body: resolved
        ? `${input.requestNumber} was resolved. Open Support to read the reply.`
        : `${input.requestNumber} is being worked on by the support team.`,
      href: "/client-portal",
    },
  });
}
