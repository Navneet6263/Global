import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigService } from "@nestjs/config";
import { SubjectPiiService } from "../src/common/security/subject-pii.service";
import { SecretBoxService } from "../src/common/security/secret-box.service";
import {
  snapshotForApproval,
  type ApprovalCase,
} from "../src/reports/report-snapshot";

void test("approved reports include authorised encrypted employee reference and actual service DTO fields only", () => {
  const pii = new SubjectPiiService(
    new SecretBoxService(
      new ConfigService({
        DATA_ENCRYPTION_KEY: "synthetic-report-test-key-not-for-production",
      }),
    ),
  );
  const ciphertext = pii.seal({
    employeeCode: "EMP-4431",
    email: "not-in-report@example.invalid",
    phone: "+919999999999",
  });
  const at = new Date("2026-09-08T00:00:00Z");
  const row = {
    caseNumber: "SG-TEST",
    client: { displayName: "Client" },
    subject: {
      fullName: "Subject",
      employeeCode: null,
      piiCiphertext: ciphertext,
      piiKeyVersion: 1,
      dateOfBirth: null,
    },
    riskLevel: "LOW",
    services: [
      {
        serviceFamily: "VENDORCHECK",
        configurationJson: JSON.stringify({
          organisationName: "Acme Business",
          registrationNumber: "REG-1",
          gstin: "22AAAAA0000A1Z5",
          conflictOfInterest: "None declared",
          directorships: "Example Limited",
          declaration: "Information confirmed",
          referenceContacts: "Authorised HR desk",
          secretToken: "must-not-appear",
          bankPassword: "must-not-appear",
        }),
      },
    ],
    qaReviews: [
      { createdAt: at, reviewer: { displayName: "Independent reviewer" } },
    ],
    documents: [],
    fieldVisits: [],
    checks: [],
  } as unknown as ApprovalCase;
  assert.throws(
    () => snapshotForApproval(row, "Manager", "Reviewed findings", at),
    /Authorized subject decryption/,
  );
  const snapshot = snapshotForApproval(
    row,
    "Manager",
    "Reviewed findings",
    at,
    pii,
  );
  const details = new Map(snapshot.identityDetails);
  assert.equal(details.get("Employee reference"), "EMP-4431");
  assert.equal(details.get("Organisation name"), "Acme Business");
  assert.equal(details.get("Declared conflict of interest"), "None declared");
  assert.equal(details.get("Declared directorships"), "Example Limited");
  assert.equal(details.get("Submitted declaration"), "Information confirmed");
  assert.equal(
    details.get("Provided reference contacts"),
    "Authorised HR desk",
  );
  const serialized = JSON.stringify(snapshot);
  for (const privateValue of [
    "must-not-appear",
    "not-in-report@example.invalid",
    "+919999999999",
    ciphertext!,
  ]) {
    assert.ok(!serialized.includes(privateValue));
  }
});
