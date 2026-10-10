import { NotFoundException } from "@nestjs/common";
import type { Prisma } from "../../generated/prisma/client";
import type { Actor } from "./actor";

const ALL_COMPANIES = ["PLATFORM_ADMIN", "OPS_MANAGER"];

/** Companies an RM works for: its assigned clients (Operations / Admin: every client). */
export function rmClientWhere(actor: Actor): Prisma.ClientWhereInput {
  if (actor.roles.some((role) => ALL_COMPANIES.includes(role)))
    return { tenantId: actor.tenantId };
  const ids = (actor.spocClients ?? []).map((client) => client.id);
  return { tenantId: actor.tenantId, id: { in: ids.length ? ids : [-1n] } };
}

/** One of the RM's companies, or 404 when it is not assigned to this RM. */
export async function rmClient(
  prisma: { client: Pick<Prisma.ClientDelegate, "findFirst"> },
  actor: Actor,
  clientPublicId: string,
) {
  const client = await prisma.client.findFirst({
    where: { ...rmClientWhere(actor), publicId: clientPublicId },
    select: { id: true, publicId: true, displayName: true },
  });
  if (!client)
    throw new NotFoundException("Company not found or not assigned to you");
  return client;
}
