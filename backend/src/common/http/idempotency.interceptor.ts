import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  type NestInterceptor,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import {
  catchError,
  from,
  map,
  mergeMap,
  type Observable,
  throwError,
} from "rxjs";
import type { Actor } from "../auth/actor";
import { PrismaService } from "../../database/prisma.service";

type AuthenticatedRequest = FastifyRequest & { user?: Actor };

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<FastifyReply>();
    if (
      !["POST", "PUT", "PATCH", "DELETE"].includes(request.method) ||
      !request.user
    ) {
      return next.handle();
    }
    const key = this.header(request, "idempotency-key");
    if (!key || !/^[A-Za-z0-9._:-]{16,100}$/.test(key)) {
      throw new BadRequestException(
        "A valid Idempotency-Key header is required for authenticated write requests",
      );
    }
    const pathname = new URL(request.url, "http://internal").pathname;
    const route = `${request.method} ${pathname}`.slice(0, 160);
    const requestHash = createHash("sha256")
      .update(
        this.stableJson({
          actor: request.user.userPublicId,
          body: request.body ?? null,
          contentLength: this.header(request, "content-length") ?? null,
        }),
      )
      .digest("hex");
    const unique = {
      tenantId_key_route: { tenantId: request.user.tenantId, key, route },
    };
    const recordWhere = { tenantId: request.user.tenantId, key, route };
    let existing = await this.prisma.idempotencyKey.findUnique({
      where: unique,
    });
    if (existing && existing.expiresAt <= new Date()) {
      await this.prisma.idempotencyKey.delete({ where: unique });
      existing = null;
    }
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException(
          "Idempotency key was already used with a different request",
        );
      }
      if (existing.responseJson && existing.responseCode) {
        response.header("x-idempotent-replay", "true");
        response.code(existing.responseCode);
        return from([JSON.parse(existing.responseJson) as unknown]);
      }
      throw new ConflictException(
        "An identical request is already in progress",
      );
    }
    try {
      await this.prisma.idempotencyKey.create({
        data: {
          tenantId: request.user.tenantId,
          key,
          route,
          requestHash,
          expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
        },
      });
    } catch {
      throw new ConflictException(
        "An identical request is already in progress",
      );
    }

    return next.handle().pipe(
      catchError((error: unknown) =>
        from(
          this.prisma.idempotencyKey.deleteMany({ where: recordWhere }),
        ).pipe(mergeMap(() => throwError(() => error))),
      ),
      mergeMap((value: unknown) =>
        from(
          this.prisma.idempotencyKey.update({
            where: unique,
            data: {
              responseCode: response.statusCode,
              responseJson: this.stableJson(value),
            },
          }),
        ).pipe(map(() => value)),
      ),
    );
  }

  private stableJson(value: unknown): string {
    return JSON.stringify(this.canonicalize(value));
  }

  private canonicalize(value: unknown): unknown {
    if (typeof value === "bigint") return value.toString();
    if (Array.isArray(value)) {
      return value.map((item) => this.canonicalize(item));
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, item]) => [key, this.canonicalize(item)]),
      );
    }
    return value;
  }

  private header(request: FastifyRequest, name: string) {
    const value = request.headers[name];
    return Array.isArray(value) ? value[0] : value;
  }
}
