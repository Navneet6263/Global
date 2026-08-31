import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { IS_PUBLIC_KEY, PERMISSIONS_KEY, ROLES_KEY } from "./auth.decorators";
import type { Actor } from "./actor";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

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
