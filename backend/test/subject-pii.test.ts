import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigService } from "@nestjs/config";
import { SecretBoxService } from "../src/common/security/secret-box.service";
import { SubjectPiiService } from "../src/common/security/subject-pii.service";

function createService() {
  const secretBox = new SecretBoxService(
    new ConfigService({
      JWT_REFRESH_SECRET: "refresh-secret-0123456789abcdef0123456789",
      DATA_ENCRYPTION_KEY: "data-key-0123456789abcdef0123456789abcd",
    }),
  );
  return new SubjectPiiService(secretBox);
}

void test("candidate contact data is encrypted at rest and restored for authorised views", () => {
  const service = createService();
  const encrypted = service.seal({
    email: "Candidate@Example.com",
    phone: "+919999999999",
    employeeCode: "EMP-42",
  });
  assert.ok(encrypted);
  assert.equal(encrypted.includes("candidate@example.com"), false);
  assert.equal(encrypted.includes("9999999999"), false);
  assert.deepEqual(service.open({ piiCiphertext: encrypted }), {
    email: "candidate@example.com",
    phone: "+919999999999",
    employeeCode: "EMP-42",
  });
});

void test("legacy subject contact columns remain readable during migration", () => {
  const service = createService();
  assert.deepEqual(
    service.open({
      piiCiphertext: null,
      email: "legacy@example.com",
      phone: null,
      employeeCode: "OLD-7",
    }),
    { email: "legacy@example.com", employeeCode: "OLD-7" },
  );
});
