import { ConfigService } from "@nestjs/config";
import { SecretBoxService } from "../../src/common/security/secret-box.service";
import { SubjectPiiService } from "../../src/common/security/subject-pii.service";
import type { PrismaService } from "../../src/database/prisma.service";
import { RequestReuploadService } from "../../src/vendor-requests/services/request-reupload.service";
import { VendorAssignmentsRepository } from "../../src/vendor-requests/vendor-assignments.repository";
import { testActor } from "./test-actor";
import { CLIENT_A, DOC, type Args } from "./vendor-fixtures";

/** A SPOC-RM assigned to clients 21 (A) and 22 (B). */
export const spocAB = testActor(
  ["SPOC_RM"],
  ["dashboard:read", "notification:read", "vendor:assign"],
  {
    spocClients: [
      { id: 21n, publicId: CLIENT_A, name: "Client A" },
      { id: 22n, publicId: "22222222-2222-4222-8222-222222222222", name: "B" },
    ],
  },
);

export const config = new ConfigService({
  WEB_ORIGIN: "https://verify.saplingglobal.in",
  JWT_REFRESH_SECRET: "test-refresh-secret-with-sufficient-entropy",
});
export const secrets = new SecretBoxService(config);
export const pii = new SubjectPiiService(secrets);

export const rejectedAttempt = {
  publicId: "a1",
  attempt: 1,
  status: "REJECTED",
};

export function documentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 91n,
    publicId: DOC,
    type: "EDUCATION_CERTIFICATE",
    status: "AVAILABLE",
    version: 4,
    currentVersion: 1,
    case: {
      id: 81n,
      publicId: "case-1",
      caseNumber: "SG-20260928-600E89",
      status: "IN_PROGRESS",
      branchId: null,
      clientId: 21n,
      assignedOpsUserId: null,
      subject: {
        email: "vivo@example.com",
        phone: null,
        employeeCode: null,
        piiCiphertext: null,
        piiKeyVersion: 1,
      },
    },
    vendorAssignments: [rejectedAttempt],
    ...overrides,
  };
}

export function reuploadHarness(
  row: unknown,
  options: { locked?: boolean; updated?: number } = {},
) {
  const calls: Record<string, Args[]> = {};
  const record =
    (key: string, result: unknown) =>
    (value: Args): Promise<unknown> => {
      (calls[key] ??= []).push(value);
      return Promise.resolve(result);
    };
  const tx = {
    document: {
      findFirst: record("find", row),
      updateMany: record("update", { count: options.updated ?? 1 }),
    },
    verificationCase: {
      updateMany: record("lock", { count: options.locked === false ? 0 : 1 }),
    },
    auditEvent: { create: record("audit", {}) },
    user: { findMany: record("ops", [{ id: 51n }]) },
    notification: { createMany: record("notify", { count: 1 }) },
    outboxEvent: { create: record("outbox", {}) },
    candidatePortalAccess: {
      findFirst: record("link", { expiresAt: new Date("2026-10-10") }),
    },
    vendorAssignment: {
      update: record("vendorWrite", {}),
      updateMany: record("vendorWrite", {}),
    },
  };
  const prisma = {
    $transaction: (operation: (client: typeof tx) => Promise<unknown>) =>
      operation(tx),
  } as unknown as PrismaService;
  return {
    service: new RequestReuploadService(
      new VendorAssignmentsRepository(prisma),
      config,
      secrets,
      pii,
    ),
    calls,
  };
}

export const input = {
  message: "Please upload a clear, complete certificate.",
  version: 4,
};
