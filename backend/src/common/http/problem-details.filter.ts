import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<FastifyReply>();
    const request = http.getRequest<FastifyRequest>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : this.isDatabaseUnavailable(exception)
          ? HttpStatus.SERVICE_UNAVAILABLE
          : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = this.messageFrom(raw, exception, status);
    const path = request.url.split("?", 1)[0] || "/";

    if (status >= 500) {
      this.logger.error({
        requestId: request.id,
        path,
        exception,
      });
    }

    if (status === 503) {
      response.header("retry-after", "5");
    }

    response
      .status(status)
      .type("application/problem+json")
      .send({
        type: `urn:sapling-global:problem:http:${status}`,
        title: HttpStatus[status] ?? "Error",
        status,
        detail: message,
        instance: path,
        requestId: request.id,
      });
  }

  private messageFrom(
    raw: unknown,
    exception: unknown,
    status: number,
  ): string | string[] {
    if (typeof raw === "string") return raw;
    if (raw && typeof raw === "object" && "message" in raw) {
      return (raw as { message: string | string[] }).message;
    }
    if (status === 503) {
      return "A required service is temporarily unavailable; retry shortly";
    }
    if (status >= 500) return "An unexpected error occurred";
    return exception instanceof Error ? exception.message : "Request failed";
  }

  private isDatabaseUnavailable(exception: unknown): boolean {
    if (!exception || typeof exception !== "object") return false;
    const code = "code" in exception ? String(exception.code) : "";
    if (
      [
        "ETIMEOUT",
        "ESOCKET",
        "ECONNCLOSED",
        "P1001",
        "P1002",
        "P2024",
      ].includes(code)
    ) {
      return true;
    }
    const message = exception instanceof Error ? exception.message : "";
    return /failed to connect|connection.*(?:closed|timeout)|pool.*timeout/i.test(
      message,
    );
  }
}
