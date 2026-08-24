import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from "@nestjs/common";
import { map, type Observable } from "rxjs";

@Injectable()
export class JsonSafeInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(map((value: unknown) => this.serialize(value)));
  }

  private serialize(value: unknown): unknown {
    if (typeof value === "bigint") return value.toString();
    if (
      value instanceof Date ||
      value instanceof Buffer ||
      value instanceof StreamableFile
    ) {
      return value;
    }
    if (Array.isArray(value)) return value.map((item) => this.serialize(item));
    if (
      value &&
      typeof value === "object" &&
      Object.getPrototypeOf(value) === Object.prototype
    ) {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, this.serialize(item)]),
      );
    }
    return value;
  }
}
