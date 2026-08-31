import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createConnection } from "node:net";
import type { UploadedBinary } from "../common/http/uploaded-binary";
import { inspectDocumentStructure } from "./document-structure-inspection";

const allowedMime = new Set(["application/pdf", "image/jpeg", "image/png"]);

@Injectable()
export class ContentInspectionService {
  private readonly logger = new Logger(ContentInspectionService.name);
  constructor(private readonly config: ConfigService) {}

  async inspect(
    file: UploadedBinary,
    maxBytes: number,
    options?: { documentType: string },
  ): Promise<void> {
    if (!file.buffer?.length)
      throw new BadRequestException("Document file is empty");
    if (file.size > maxBytes)
      throw new BadRequestException("Document exceeds upload limit");
    if (!allowedMime.has(file.mimetype))
      throw new BadRequestException("Only PDF, JPEG, and PNG are allowed");
    if (!this.magicMatches(file.buffer, file.mimetype)) {
      throw new BadRequestException(
        "File contents do not match the declared type",
      );
    }
    if (
      file.buffer.includes(Buffer.from("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR"))
    ) {
      throw new BadRequestException("Malware test signature detected");
    }
    if (options) {
      await inspectDocumentStructure(file, options.documentType);
    }
    await this.scanWithClamAv(file.buffer);
  }

  async probe(): Promise<void> {
    await this.scanWithClamAv(Buffer.from("sapling-malware-scanner-health"));
  }

  private async scanWithClamAv(contents: Buffer) {
    const host = this.config.get<string>("CLAMAV_HOST");
    const required = this.config.get<boolean>("MALWARE_SCAN_REQUIRED", false);
    if (!host) {
      if (required)
        throw new ServiceUnavailableException(
          "Malware scanner is not configured",
        );
      return;
    }
    try {
      const result = await new Promise<string>((resolve, reject) => {
        const socket = createConnection({
          host,
          port: this.config.get<number>("CLAMAV_PORT", 3310),
        });
        const chunks: Buffer[] = [];
        socket.setTimeout(15_000);
        socket.on("connect", () => {
          socket.write("zINSTREAM\0");
          for (let offset = 0; offset < contents.length; offset += 64 * 1024) {
            const chunk = contents.subarray(offset, offset + 64 * 1024);
            const length = Buffer.allocUnsafe(4);
            length.writeUInt32BE(chunk.length);
            socket.write(length);
            socket.write(chunk);
          }
          socket.write(Buffer.alloc(4));
        });
        socket.on("data", (chunk: Buffer) => chunks.push(chunk));
        socket.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        socket.on("timeout", () =>
          socket.destroy(new Error("Malware scan timed out")),
        );
        socket.on("error", reject);
      });
      if (result.includes("FOUND"))
        throw new BadRequestException(
          "Malware was detected in the uploaded file",
        );
      if (!result.includes("OK"))
        throw new Error(
          `Unexpected malware scanner response: ${result.slice(0, 120)}`,
        );
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (required)
        throw new ServiceUnavailableException("Malware scanner is unavailable");
      this.logger.warn(
        `Malware scan skipped: ${error instanceof Error ? error.message : "scanner error"}`,
      );
    }
  }

  private magicMatches(buffer: Buffer, mime: string): boolean {
    if (mime === "application/pdf")
      return buffer.subarray(0, 5).toString() === "%PDF-";
    if (mime === "image/jpeg")
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (mime === "image/png") {
      return buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    }
    return false;
  }
}
