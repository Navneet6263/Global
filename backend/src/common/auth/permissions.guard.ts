import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import {
  IS_PUBLIC_KEY,
  PERMISSIONS_KEY,
  ROLES_KEY,
  VIEW_ONLY_ADMIN_ALLOWED_KEY,
} from "./auth.decorators";
import { isViewOnlyAdmin } from "./view-only";
import type { Actor } from "./actor";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly config?: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user: Actor }>();
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      isViewOnlyAdmin(
        request.user.roles,
        this.config?.get<boolean>("PLATFORM_ADMIN_VIEW_ONLY", true) ?? true,
      ) &&
      !this.reflector.getAllAndOverride<boolean>(VIEW_ONLY_ADMIN_ALLOWED_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      throw new ForbiddenException(
        "Platform Admin has view-only access. Escalate the case or ask Operations to make this change.",
      );
    }
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (
      requiredRoles?.length &&
      !request.user.roles.some((role) => requiredRoles.includes(role))
    ) {
      throw new ForbiddenException("Your role cannot perform this action");
    }

    const required = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const allowed = new Set(request.user.permissions);
    if (
      allowed.has("*") ||
      required.every((permission) => allowed.has(permission))
    ) {
      return true;
    }
    throw new ForbiddenException(
      "You do not have permission to perform this action",
    );
  }
}
