import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

@Injectable()
export class SecretBoxService {
  private readonly key: Buffer;
  constructor(config: ConfigService) {
    this.key = createHash("sha256")
      .update(
        config.get<string>("DATA_ENCRYPTION_KEY") ??
          config.getOrThrow<string>("JWT_REFRESH_SECRET"),
      )
      .digest();
  }

  seal(value: unknown): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, ciphertext]).toString("base64url");
  }

  open<T>(sealed: string): T {
    const payload = Buffer.from(sealed, "base64url");
    if (payload.length < 29 || payload.toString("base64url") !== sealed)
      throw new Error("Encrypted outbox payload is invalid");
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const ciphertext = payload.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(tag);
    return JSON.parse(
      Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
        "utf8",
      ),
    ) as T;
  }
}
