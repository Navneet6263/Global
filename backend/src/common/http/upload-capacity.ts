import { HttpException, HttpStatus } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { FastifyRequest } from "fastify";
import { readUploadedBinary, type UploadedBinary } from "./uploaded-binary";

/** Bounds the whole read/inspect/store transaction, not just multipart parsing. */
export class UploadCapacity {
  private active = 0;
  private readonly owners = new Map<string, number>();

  async run<T>(
    owner: string,
    maximum: number,
    perOwner: number,
    work: () => Promise<T>,
  ): Promise<T> {
    const owned = this.owners.get(owner) ?? 0;
    if (this.active >= maximum || owned >= perOwner) {
      throw new HttpException(
        "Upload service is busy. Keep your file and retry shortly; this upload was not accepted.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.active++;
    this.owners.set(owner, owned + 1);
    try {
      return await work();
    } finally {
      this.active--;
      const remaining = (this.owners.get(owner) ?? 1) - 1;
      if (remaining) this.owners.set(owner, remaining);
      else this.owners.delete(owner);
    }
  }
}

const capacity = new UploadCapacity();
export function withUploadedBinary<T>(
  request: FastifyRequest,
  config: ConfigService,
  owner: string,
  consume: (file: UploadedBinary) => Promise<T>,
): Promise<T> {
  return capacity.run(
    owner,
    config.get<number>("UPLOAD_CONCURRENCY", 4),
    config.get<number>("UPLOAD_PER_ACTOR_CONCURRENCY", 2),
    async () => {
      const file = await readUploadedBinary(
        request,
        config.get<number>("UPLOAD_MAX_BYTES", 10_485_760),
      );
      return consume(file);
    },
  );
}
