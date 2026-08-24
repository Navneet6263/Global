import type { Actor } from "./actor";

export function caseAccessScope(actor: Actor) {
  return {
    tenantId: actor.tenantId,
    ...(actor.clientId ? { clientId: actor.clientId } : {}),
  };
}
