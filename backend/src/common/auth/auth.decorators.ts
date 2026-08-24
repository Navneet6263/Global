import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { Actor } from "./actor";

export const IS_PUBLIC_KEY = "isPublic";
export const PERMISSIONS_KEY = "permissions";
export const PASSWORD_CHANGE_PENDING_ALLOWED_KEY =
  "passwordChangePendingAllowed";

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
export const AllowPasswordChangePending = () =>
  SetMetadata(PASSWORD_CHANGE_PENDING_ALLOWED_KEY, true);

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor => {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user: Actor }>();
    return request.user;
  },
);
