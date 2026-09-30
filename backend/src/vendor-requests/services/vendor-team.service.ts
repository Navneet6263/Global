import { Injectable } from "@nestjs/common";
import type { Actor } from "../../common/auth/actor";
import {
  VendorTeamRepository,
  type TeamMemberRow,
} from "../vendor-team.repository";
import { isMainVendor } from "./vendor-scope";

export function toTeamMember(row: TeamMemberRow) {
  return {
    id: row.publicId,
    name: row.displayName,
    email: row.email,
    phone: row.phone,
    status: row.status,
    mustChangePassword: row.mustChangePassword,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
    version: row.version,
    pendingRequests: row._count.handledVendorRequests,
  };
}

/**
 * The Team page. A Main Vendor sees its Admin limit, the ACTIVE count and its team;
 * a team user sees only who manages it (team users never manage a team).
 */
@Injectable()
export class VendorTeamService {
  constructor(private readonly repository: VendorTeamRepository) {}

  async overview(actor: Actor) {
    if (!isMainVendor(actor)) {
      const owner = actor.vendorOwnerId
        ? await this.repository.findOwnerName(
            actor.tenantId,
            actor.vendorOwnerId,
          )
        : null;
      return {
        role: "MEMBER" as const,
        managedBy: owner?.displayName ?? null,
        limit: 0,
        active: 0,
        remaining: 0,
        members: [],
      };
    }
    const [policy, rows] = await Promise.all([
      this.repository.policy(actor.userId),
      this.repository.members(actor.tenantId, actor.userId),
    ]);
    const limit = policy?.maxActiveUsers ?? 0;
    const active = rows.filter((row) => row.status === "ACTIVE").length;
    return {
      role: "OWNER" as const,
      managedBy: null,
      limit,
      active,
      remaining: Math.max(0, limit - active),
      members: rows.map(toTeamMember),
    };
  }
}
