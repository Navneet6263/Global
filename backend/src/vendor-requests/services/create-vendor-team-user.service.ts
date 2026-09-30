import { Injectable } from "@nestjs/common";
import { hashPassword } from "../../auth/password";
import type { Actor } from "../../common/auth/actor";
import {
  assertEmailAvailable,
  insertUserAccount,
  resolveRoles,
} from "../../users/user-accounts";
import { VendorTeamRepository } from "../vendor-team.repository";
import type { CreateVendorTeamUserDto } from "../vendor-requests.validation";
import { assertMainVendor } from "./vendor-scope";
import { assertTeamCapacity } from "./vendor-team-rules";

/**
 * A Main Vendor adds a team login through the same account core as Admin/Ops user
 * creation. The role is always VENDOR, there is no branch or client, and the ACTIVE
 * team count is checked under a lock so it can never exceed the Admin limit.
 */
@Injectable()
export class CreateVendorTeamUserService {
  constructor(private readonly repository: VendorTeamRepository) {}

  async create(actor: Actor, input: CreateVendorTeamUserDto) {
    assertMainVendor(actor);
    // Hashing is slow: done before the transaction so the owner lock stays short.
    const passwordHash = await hashPassword(input.temporaryPassword);
    return this.repository.transaction(async (tx) => {
      const capacity = await assertTeamCapacity(
        tx,
        actor.tenantId,
        actor.userId,
      );
      await assertEmailAvailable(tx, actor.tenantId, input.email);
      const roles = await resolveRoles(tx, actor.tenantId, ["VENDOR"]);
      const row = await insertUserAccount(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        email: input.email,
        displayName: input.displayName,
        phone: input.phone,
        passwordHash,
        roles,
        vendorOwnerId: actor.userId,
        audit: {
          createdVia: "VENDOR_TEAM",
          vendorOwnerId: actor.userPublicId,
          activeBefore: capacity.active,
          limit: capacity.limit,
        },
      });
      const { publicId, ...user } = row;
      return { id: publicId, ...user, roles: ["VENDOR"] };
    });
  }
}
