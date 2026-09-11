import { ForbiddenException } from "@nestjs/common";
import type { Actor } from "../common/auth/actor";

export function requireClientFinanceScope(actor: Actor) {
  if (!actor.clientId || !actor.roles.includes("CLIENT_ADMIN")) {
    throw new ForbiddenException(
      "A client workspace is required for billing access",
    );
  }
  return { tenantId: actor.tenantId, clientId: actor.clientId };
}
