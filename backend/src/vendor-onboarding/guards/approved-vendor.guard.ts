import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { Actor } from "../../common/auth/actor";

/**
 * Ensures that vendor users (both Main Vendor and Team Members) have an approved
 * vendor profile before they can access operational vendor endpoints.
 */
@Injectable()
export class ApprovedVendorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const actor: Actor = request.user;
    if (!actor || !actor.roles.includes("VENDOR")) {
      return true;
    }
    if (actor.vendorStatus !== "APPROVED") {
      throw new ForbiddenException(
        "Vendor account is not approved yet. Complete document verification at /vendor/onboarding.",
      );
    }
    return true;
  }
}
