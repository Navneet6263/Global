import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import {
  IS_PUBLIC_KEY,
  PASSWORD_CHANGE_PENDING_ALLOWED_KEY,
} from "./auth.decorators";
import type { Actor } from "./actor";

@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }
    if (
      this.reflector.getAllAndOverride<boolean>(
        PASSWORD_CHANGE_PENDING_ALLOWED_KEY,
        targets,
      )
    ) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: Actor }>();
    if (!request.user?.mustChangePassword) return true;

    throw new ForbiddenException(
      "Change your temporary password before using this operation",
    );
  }
}
