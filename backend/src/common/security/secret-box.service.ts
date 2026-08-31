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
  private readonly keys = new Map<number, Buffer>();
  readonly activeVersion: number;

  constructor(config: ConfigService) {
    this.activeVersion = config.get<number>("DATA_ENCRYPTION_KEY_VERSION", 1);
    const activeKey =
      config.get<string>("DATA_ENCRYPTION_KEY") ??
      config.getOrThrow<string>("JWT_REFRESH_SECRET");
    this.keys.set(this.activeVersion, this.derive(activeKey));

    const previous = config.get<string>("DATA_ENCRYPTION_PREVIOUS_KEYS");
    if (previous) {
      const parsed = JSON.parse(previous) as Record<string, string>;
      for (const [version, key] of Object.entries(parsed)) {
        this.keys.set(Number(version), this.derive(key));
      }
    }
  }

  seal(value: unknown): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(
      "aes-256-gcm",
      this.keyFor(this.activeVersion),
      iv,
    );
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    const payload = Buffer.concat([iv, tag, ciphertext]).toString("base64url");
    return `v${this.activeVersion}.${payload}`;
  }

  open<T>(sealed: string, legacyVersion = 1): T {
    const match = /^v([1-9]\d*)\.(.+)$/.exec(sealed);
    const version = match ? Number(match[1]) : legacyVersion;
    const encoded = match?.[2] ?? sealed;
    const payload = Buffer.from(encoded, "base64url");
    if (payload.length < 29 || payload.toString("base64url") !== encoded)
      throw new Error("Encrypted outbox payload is invalid");
    const iv = payload.subarray(0, 12);
    const tag = payload.subarray(12, 28);
    const ciphertext = payload.subarray(28);
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.keyFor(version),
      iv,
    );
    decipher.setAuthTag(tag);
    return JSON.parse(
      Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
        "utf8",
      ),
    ) as T;
  }

  private derive(value: string) {
    return createHash("sha256").update(value).digest();
  }

  private keyFor(version: number) {
    const key = this.keys.get(version);
    if (!key) {
      throw new Error(`Data-encryption key version ${version} is unavailable`);
    }
    return key;
  }
}
