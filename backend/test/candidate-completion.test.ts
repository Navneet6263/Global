import assert from "node:assert/strict";
import { test } from "node:test";
import { UnauthorizedException } from "@nestjs/common";
import type { PrismaService } from "../src/database/prisma.service";
import type { SecretBoxService } from "../src/common/security/secret-box.service";
import type { SubjectPiiService } from "../src/common/security/subject-pii.service";
import {
  candidateRequestedTypes,
  candidateUploadItems,
} from "../src/candidate-portal/candidate-upload-state";
import {
  authorizeCandidateAccess,
  digestPortalToken,
} from "../src/candidate-portal/candidate-access-authorizer";
import { issueCandidateLink } from "../src/candidate-portal/candidate-link";

const doc = (
  type: string,
  status: string,
  version = 1,
  reviewNote: string | null = null,
) => ({
  type,
  status,
  currentVersion: version,
  reviewNote,
});

void test("the candidate sees only requested documents plus anything sent back", () => {
  const state = candidateUploadItems(
    ["PAN", "ADDRESS_PROOF"],
    [
      doc("PAN", "UPLOADED"),
      doc("EDUCATION_CERTIFICATE", "REUPLOAD_REQUIRED", 1, "Blurred"),
    ],
  );
  assert.deepEqual(
    state.items.map((item) => [item.type, item.state]),
    [
      ["PAN", "UPLOADED"],
      ["ADDRESS_PROOF", "NEEDED"],
      ["EDUCATION_CERTIFICATE", "REUPLOAD"],
    ],
  );
  assert.equal(state.items[2]!.reviewNote, "Blurred");
  assert.equal(state.complete, false);
  assert.equal(
    candidateUploadItems(["PAN"], [doc("PAN", "VERIFIED")]).complete,
    true,
  );
});

void test("a link the candidate completed shows its done page but cannot upload again", async () => {
  const token = "candidate-token";
  const access = {
    id: 1n,
    publicId: "a-1",
    tokenHash: digestPortalToken(token),
    revokedAt: new Date(),
    completedAt: new Date(),
    expiresAt: new Date(Date.now() + 86_400_000),
  };
  const prisma = {
    candidatePortalAccess: { findUnique: () => Promise.resolve(access) },
  } as unknown as PrismaService;
  const read = await authorizeCandidateAccess(prisma, "a-1", token, {
    allowCompleted: true,
  });
  assert.equal(read.publicId, "a-1");
  await assert.rejects(
    authorizeCandidateAccess(prisma, "a-1", token),
    UnauthorizedException,
  );
});

void test("sending a document back issues a new emailed link and retires the old one", async () => {
  const calls: Array<{ kind: string; data: unknown }> = [];
  const tx = {
    candidatePortalAccess: {
      updateMany: (input: unknown) => {
        calls.push({ kind: "revoke", data: input });
        return Promise.resolve({ count: 1 });
      },
      create: () => Promise.resolve({ publicId: "a-2" }),
    },
    auditEvent: {
      create: (input: unknown) => {
        calls.push({ kind: "audit", data: input });
        return Promise.resolve({});
      },
    },
    outboxEvent: {
      create: (input: unknown) => {
        calls.push({ kind: "outbox", data: input });
        return Promise.resolve({});
      },
    },
  };
  const result = await issueCandidateLink(
    tx as never,
    {
      secretBox: {
        seal: (value: unknown) => JSON.stringify(value),
      } as unknown as SecretBoxService,
      pii: {
        open: () => ({ email: "riya@example.com" }),
      } as unknown as SubjectPiiService,
      webOrigin: "https://app.example.com",
    },
    {
      tenantId: 1n,
      caseId: 5n,
      casePublicId: "case-5",
      subject: {},
      sendNotification: true,
      reason: "pan: the number is not readable",
    },
  );
  assert.equal(result.delivery.queued, true);
  assert.ok(calls.some((call) => call.kind === "revoke"));
  const audit = calls.find((call) => call.kind === "audit")?.data as {
    data: { action: string };
  };
  assert.equal(audit.data.action, "candidate-portal.access-reissued");
  const outbox = calls.find((call) => call.kind === "outbox")?.data as {
    data: { topic: string; payloadJson: string };
  };
  assert.equal(outbox.data.topic, "candidate.access.issued");
  const sealed = JSON.parse(
    JSON.parse(outbox.data.payloadJson).secret as string,
  ) as {
    portalUrl: string;
    reason: string;
  };
  assert.match(
    sealed.portalUrl,
    /^https:\/\/app\.example\.com\/candidate\/a-2#token=/,
  );
  assert.equal(sealed.reason, "pan: the number is not readable");
});

void test("a package without a document list still asks for the proofs its checks need", () => {
  assert.deepEqual(
    candidateRequestedTypes(
      [],
      [{ type: "EMPLOYMENT" }, { type: "EDUCATION" }, { type: "ADDRESS" }],
    ),
    ["EMPLOYMENT_PROOF", "EDUCATION_CERTIFICATE", "ADDRESS_PROOF"],
  );
  // Package documents come first; nothing is asked twice; database-only checks ask nothing.
  assert.deepEqual(
    candidateRequestedTypes(
      ["PAN", "EMPLOYMENT_PROOF"],
      [{ type: "EMPLOYMENT" }, { type: "CRIMINAL" }, { type: "identity" }],
    ),
    ["PAN", "EMPLOYMENT_PROOF", "AADHAAR"],
  );
});
