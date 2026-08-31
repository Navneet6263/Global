import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  Logger,
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
import { SecretBoxService } from "../security/secret-box.service";
import { PrismaService } from "../../database/prisma.service";

type AuthenticatedRequest = FastifyRequest & { user?: Actor };
type IdempotencyWhere = {
  tenantId_key_route: { tenantId: bigint; key: string; route: string };
};

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: SecretBoxService,
  ) {}

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
    const contentSha256 = this.contentDigest(request);
    const requestHash = createHash("sha256")
      .update(
        this.stableJson({
          actor: request.user.userPublicId,
          body: request.body ?? null,
          contentLength: this.header(request, "content-length") ?? null,
          contentSha256,
          semanticHeaders: {
            capturedAt: this.header(request, "x-captured-at") ?? null,
            evidenceId: this.header(request, "x-evidence-id") ?? null,
          },
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
      if (existing.responseCiphertext && existing.responseCode) {
        response.header("x-idempotent-replay", "true");
        response.code(existing.responseCode);
        return from([
          this.secrets.open<unknown>(
            existing.responseCiphertext,
            existing.responseKeyVersion ?? 1,
          ),
        ]);
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
    } catch (error) {
      if (!this.isUniqueConflict(error)) throw error;
      throw new ConflictException(
        "An identical request is already in progress",
      );
    }

    return next.handle().pipe(
      catchError((error: unknown) =>
        from(
          this.prisma.idempotencyKey
            .deleteMany({ where: recordWhere })
            .catch(() => undefined),
        ).pipe(mergeMap(() => throwError(() => error))),
      ),
      mergeMap((value: unknown) =>
        from(
          this.persistResponse(unique, response.statusCode, value).catch(
            (error: unknown) => {
              this.logger.error(
                `Business write completed but idempotency response persistence failed: ${
                  error instanceof Error ? error.message : "unknown error"
                }`,
              );
            },
          ),
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

  private contentDigest(request: FastifyRequest) {
    const contentType = this.header(request, "content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      return null;
    }
    const digest = this.header(request, "x-content-sha256")?.toLowerCase();
    if (!digest || !/^[a-f0-9]{64}$/.test(digest)) {
      throw new BadRequestException(
        "Multipart writes require an x-content-sha256 payload digest",
      );
    }
    return digest;
  }

  private isUniqueConflict(error: unknown) {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    );
  }

  private async persistResponse(
    where: IdempotencyWhere,
    responseCode: number,
    value: unknown,
  ) {
    const data = {
      responseCode,
      responseJson: null,
      responseCiphertext: this.secrets.seal(value ?? null),
      responseKeyVersion: this.secrets.activeVersion,
      completedAt: new Date(),
    };
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await this.prisma.idempotencyKey.update({ where, data });
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
        }
      }
    }
    throw lastError;
  }
}
