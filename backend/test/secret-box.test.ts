import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigService } from "@nestjs/config";
import { SecretBoxService } from "../src/common/security/secret-box.service";

void test("outbox secrets are authenticated and encrypted", () => {
  const service = new SecretBoxService(
    new ConfigService({
      JWT_REFRESH_SECRET: "0123456789abcdef0123456789abcdef",
    }),
  );
  const plaintext = { otp: "482913", destination: "+919999999999" };
  const sealed = service.seal(plaintext);
  assert.equal(sealed.includes(plaintext.otp), false);
  assert.deepEqual(service.open(sealed), plaintext);
});

void test("tampered outbox ciphertext is rejected", () => {
  const service = new SecretBoxService(
    new ConfigService({
      JWT_REFRESH_SECRET: "0123456789abcdef0123456789abcdef",
    }),
  );
  const sealed = service.seal({ otp: "482913" });
  const replacement = sealed.endsWith("A") ? "B" : "A";
  assert.throws(() => service.open(`${sealed.slice(0, -1)}${replacement}`));
});
