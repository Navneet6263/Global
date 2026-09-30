import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { hashPassword } from "../../auth/password";
import type { Actor } from "../../common/auth/actor";
import {
  resetAccountPassword,
  revokeSessions,
} from "../../users/user-accounts";
import { VendorTeamRepository } from "../vendor-team.repository";
import type { SetVendorTeamUserStatusDto } from "../vendor-requests.validation";
import { assertMainVendor } from "./vendor-scope";
import { assertTeamCapacity, releaseDelegations } from "./vendor-team-rules";

/**
 * A Main Vendor suspends, reactivates or resets the password of its own team users.
 * Reactivation must fit the Admin limit; suspension ends every session and hands the
 * user's pending delegated requests back to the Main Vendor.
 */
@Injectable()
export class ManageVendorTeamUserService {
  constructor(private readonly repository: VendorTeamRepository) {}

  async setStatus(
    actor: Actor,
    memberPublicId: string,
    input: SetVendorTeamUserStatusDto,
  ) {
    assertMainVendor(actor);
    return this.repository.transaction(async (tx) => {
      const member = await this.repository.findMember(
        tx,
        actor.tenantId,
        actor.userId,
        memberPublicId,
      );
      if (!member) throw new NotFoundException("Team user not found");
      if (member.version !== input.version)
        throw new ConflictException("Team user changed; refresh and try again");
      if (member.status === input.status)
        throw new ConflictException(
          `This team user is already ${input.status.toLowerCase()}`,
        );
      if (input.status === "ACTIVE")
        await assertTeamCapacity(tx, actor.tenantId, actor.userId);
      const updated = await this.repository.setMemberStatus(
        tx,
        member,
        input.status,
      );
      if (updated.count !== 1)
        throw new ConflictException("Team user changed; refresh and try again");
      let returned = 0;
      if (input.status === "SUSPENDED") {
        await revokeSessions(tx, member.id);
        returned = await releaseDelegations(tx, {
          tenantId: actor.tenantId,
          ownerId: actor.userId,
          memberId: member.id,
          memberName: member.displayName,
        });
      }
      await this.repository.recordAudit(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        action: "user.updated",
        resourceType: "user",
        resourcePublicId: member.publicId,
        beforeJson: JSON.stringify({
          status: member.status,
          version: member.version,
        }),
        afterJson: JSON.stringify({
          status: input.status,
          version: member.version + 1,
          via: "VENDOR_TEAM",
          requestsReturned: returned,
        }),
      });
      return {
        id: member.publicId,
        status: input.status,
        version: member.version + 1,
        requestsReturned: returned,
      };
    });
  }

  async resetPassword(
    actor: Actor,
    memberPublicId: string,
    temporaryPassword: string,
  ) {
    assertMainVendor(actor);
    const passwordHash = await hashPassword(temporaryPassword);
    await this.repository.transaction(async (tx) => {
      const member = await this.repository.findMember(
        tx,
        actor.tenantId,
        actor.userId,
        memberPublicId,
      );
      if (!member) throw new NotFoundException("Team user not found");
      await resetAccountPassword(tx, {
        tenantId: actor.tenantId,
        actorUserId: actor.userId,
        userId: member.id,
        publicId: member.publicId,
        passwordHash,
        audit: { via: "VENDOR_TEAM" },
      });
    });
    return { reset: true };
  }
}
