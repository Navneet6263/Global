import { ForbiddenException } from "@nestjs/common";
import type { Actor } from "../../common/auth/actor";

/** A Main Vendor: a VENDOR login that is not a member of another vendor's team. */
export function isMainVendor(actor: Actor): boolean {
  return actor.roles.includes("VENDOR") && actor.vendorOwnerId === undefined;
}

/** Team management, delegation and reminders belong to the Main Vendor only. */
export function assertMainVendor(actor: Actor): void {
  if (!isMainVendor(actor))
    throw new ForbiddenException(
      "Only the main vendor account can manage its team and delegate requests",
    );
}

/**
 * The requests a vendor login may see and decide. A Main Vendor keeps exactly its
 * existing scope (everything SPOC-RM assigned to it); a team user sees only the
 * requests its Main Vendor delegated to it. Another vendor's request is never found.
 */
export function ownRequests(actor: Actor) {
  return actor.vendorOwnerId !== undefined
    ? {
        tenantId: actor.tenantId,
        vendorUserId: actor.vendorOwnerId,
        handlerUserId: actor.userId,
      }
    : { tenantId: actor.tenantId, vendorUserId: actor.userId };
}
