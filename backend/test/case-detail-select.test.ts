import "reflect-metadata";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { NotFoundException } from "@nestjs/common";
import { CaseReaderService } from "../src/cases/case-reader.service";
import { caseDetailSelect, caseListSelect } from "../src/cases/case.selects";
import type { PrismaService } from "../src/database/prisma.service";
import { pii } from "./helpers/reupload-fixtures";
import { testActor } from "./helpers/test-actor";

type ModelFields = Map<string, Map<string, string>>;

function parseSchemaModels(schemaPath: string): ModelFields {
  const models: ModelFields = new Map();
  let current: Map<string, string> | null = null;
  for (const rawLine of readFileSync(schemaPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    const start = /^model\s+(\w+)\s+\{$/.exec(line);
    if (start) {
      current = new Map();
      models.set(start[1]!, current);
      continue;
    }
    if (line === "}") {
      current = null;
      continue;
    }
    if (!current || !line || line.startsWith("//") || line.startsWith("@@")) continue;
    const fieldMatch = /^(\w+)\s+([A-Za-z0-9_]+)(?:\[\]|\?)?\b/.exec(line);
    if (fieldMatch) current.set(fieldMatch[1]!, fieldMatch[2]!);
  }
  return models;
}

function assertSelectMatchesSchema(
  models: ModelFields,
  modelName: string,
  select: Record<string, unknown>,
  path: string,
): void {
  const fields = models.get(modelName);
  assert.ok(fields, `Missing Prisma model ${modelName} at ${path}`);
  for (const [key, value] of Object.entries(select)) {
    if (key === "_count" && value && typeof value === "object") continue;
    const targetType = fields.get(key);
    assert.ok(targetType, `Unknown field "${key}" on model "${modelName}" at ${path}.${key}`);
    if (value && typeof value === "object" && "select" in value) {
      const nested = (value as { select?: Record<string, unknown> }).select;
      if (nested) {
        assertSelectMatchesSchema(models, targetType, nested, `${path}.${key}`);
      }
    }
  }
}

void test("caseListSelect and caseDetailSelect match Prisma schema models without invalid reviewedBy", () => {
  const schemaPath = resolve(__dirname, "../prisma/schema.prisma");
  const models = parseSchemaModels(schemaPath);

  assertSelectMatchesSchema(models, "VerificationCase", caseListSelect, "caseListSelect");
  assertSelectMatchesSchema(models, "VerificationCase", caseDetailSelect, "caseDetailSelect");

  const versionSelect = caseDetailSelect.documents.select.versions.select as Record<string, unknown>;
  assert.equal("reviewedBy" in versionSelect, false);
  assert.equal(versionSelect.reviewedAt, true);
  assert.equal(versionSelect.reviewStatus, true);
  assert.equal(versionSelect.reviewNote, true);
});

void test("CaseReaderService.get returns L2 document version & clarification fields and throws 404 when absent", async () => {
  const capturedSelects: unknown[] = [];
  const now = new Date("2026-11-11T10:00:00.000Z");
  const sampleRow = {
    publicId: "case-pub-1",
    caseNumber: "SG-20261111-0727E3",
    externalRef: null,
    status: "CLARIFICATION_PENDING",
    priority: "NORMAL",
    dueAt: now,
    completedAt: null,
    riskLevel: "LOW",
    version: 5,
    createdAt: now,
    updatedAt: now,
    workflowVersion: 2,
    intakeStage: "ROUTED",
    dataEntryAssignedAt: now,
    dataEntryReadyAt: now,
    stoppedFromStatus: null,
    stoppedAt: null,
    stopReason: null,
    escalatedAt: null,
    escalationNote: null,
    escalatedBy: null,
    dataEntryUser: null,
    subject: {
      publicId: "sub-1",
      fullName: "Nikhil Ranjan",
      email: "nikhil@example.com",
      phone: "9999999999",
      employeeCode: null,
      piiCiphertext: null,
      piiKeyVersion: 1,
    },
    client: {
      publicId: "cli-1",
      code: "SG",
      displayName: "Sapling Global",
      primaryRm: null,
    },
    reports: [],
    servicePackage: null,
    services: [],
    branch: null,
    assignedOpsUser: { publicId: "ops-1", displayName: "Ashish" },
    candidateAccess: [],
    qaReviewer: null,
    checks: [],
    fieldVisits: [],
    statusHistory: [],
    consents: [],
    documents: [
      {
        publicId: "doc-1",
        type: "ADDRESS_PROOF",
        status: "VERIFIED",
        currentVersion: 2,
        expiresAt: null,
        version: 2,
        reviewNote: "Clear upload",
        reviewedAt: now,
        versions: [
          {
            version: 2,
            originalName: "address-v2.pdf",
            contentType: "application/pdf",
            sizeBytes: 2048n,
            sha256: "a".repeat(64),
            malwareState: "CLEAN",
            reviewStatus: "PENDING",
            reviewNote: null,
            reviewedAt: null,
            clarification: { publicId: "clar-l2-1" },
            createdAt: now,
          },
        ],
      },
    ],
    clarifications: [
      {
        publicId: "clar-l2-1",
        level: "L2",
        status: "CANDIDATE_SUBMITTED",
        subject: "Upload clear address proof",
        requestedDocumentType: "ADDRESS_PROOF",
        submittedDocumentVersion: 2,
        rejectionCount: 0,
        lastRejectedAt: null,
        lastRejectedReason: null,
        reentryCompletedAt: null,
        dueAt: null,
        resolvedAt: null,
        createdAt: now,
        submittedDocument: {
          publicId: "doc-1",
          type: "ADDRESS_PROOF",
          currentVersion: 2,
        },
      },
    ],
    qaReviews: [],
  };

  let returnMissing = false;
  const prisma = {
    verificationCase: {
      findFirst: (args: { select?: unknown }) => {
        capturedSelects.push(args.select);
        return Promise.resolve(returnMissing ? null : sampleRow);
      },
    },
  } as unknown as PrismaService;

  const reader = new CaseReaderService(prisma, pii);
  const opsActor = testActor(["OPS_MANAGER"], ["case:read"]);
  const detail = await reader.get(opsActor, "case-pub-1");

  assert.equal(detail.caseNumber, "SG-20261111-0727E3");
  assert.equal(detail.clarifications[0]?.status, "CANDIDATE_SUBMITTED");
  assert.equal(detail.documents[0]?.versions[0]?.clarificationId, "clar-l2-1");
  assert.equal("reviewedBy" in (capturedSelects[0] as typeof caseDetailSelect).documents.select.versions.select, false);

  returnMissing = true;
  await assert.rejects(() => reader.get(opsActor, "missing-id"), NotFoundException);
});
