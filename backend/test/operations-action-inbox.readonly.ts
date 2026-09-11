/** Explicit SQL Server test: SELECT-only virtual fixtures; never inserts/deletes shared DB rows. */
import "dotenv/config";
import assert from "node:assert/strict";
import { ConfigService } from "@nestjs/config";
import type { Actor } from "../src/common/auth/actor";
import { PrismaService } from "../src/database/prisma.service";
import { Prisma } from "../src/generated/prisma/client";
import { OperationsActionsService } from "../src/dashboards/operations-actions.service";
import { operationsActionKinds } from "../src/dashboards/dto/operations-action-query.dto";

const fixtureSql = `WITH FixtureVerificationCase AS (
  SELECT id, CONVERT(varchar(36), id) publicId, CONCAT('CASE-',id) caseNumber, tenantId, branchId,
    3 clientId, 1 subjectId, status, 'NORMAL' priority, 1 version,
    CAST('2026-09-10T06:00:00' AS datetime2) updatedAt, CAST('2026-09-01' AS datetime2) dueAt
  FROM (VALUES
    (1,1,2,'CONSENT_PENDING'),(2,1,2,'DOCUMENT_PENDING'),(3,1,2,'DOCUMENT_PENDING'),
    (4,1,2,'IN_PROGRESS'),(5,1,2,'IN_PROGRESS'),(6,1,2,'IN_PROGRESS'),(7,1,2,'CLARIFICATION_PENDING'),
    (8,1,2,'COMPLETED'),(9,2,2,'CONSENT_PENDING'),(10,1,4,'CONSENT_PENDING'),
    (11,1,NULL,'IN_PROGRESS'),(12,1,2,'DOCUMENT_PENDING'),(13,1,2,'DOCUMENT_PENDING'),
    (14,1,2,'IN_PROGRESS'),(15,1,2,'DOCUMENT_PENDING'),(16,1,2,'IN_PROGRESS'),(17,1,2,'QA_REVIEW')
  ) r(id,tenantId,branchId,status)
), FixtureSubject AS (SELECT 1 id, 'Test Candidate' fullName),
FixtureClient AS (SELECT 3 id, 'Test Client' displayName),
FixtureDocument AS (
  SELECT id, caseId, type, status, 1 currentVersion, CAST(NULL AS date) expiresAt,
    DATEADD(minute,id,CAST('2026-09-10' AS datetime2)) createdAt FROM (VALUES
    (1,1,'PAN','AVAILABLE'),(2,1,'AADHAAR','AVAILABLE'),(3,2,'PAN','VERIFIED'),
    (4,3,'PAN','REUPLOAD_REQUIRED'),(5,8,'PAN','AVAILABLE'),(6,9,'PAN','AVAILABLE'),
    (7,10,'PAN','AVAILABLE'),(8,13,'PAN','VERIFIED'),(9,13,'PAN','AVAILABLE')
  ) r(id,caseId,type,status)
), FixtureDocumentVersion AS (
  SELECT id documentId, 1 version, 'CLEAN' malwareState, createdAt FROM FixtureDocument
), FixtureCaseService AS (
  SELECT caseId, requiredDocumentsJson FROM (VALUES
    (2,'["PAN"]'),(3,'["PAN"]'),(12,'["ADDRESS_PROOF"]'),(13,'["PAN"]'),(15,'invalid-json')
  ) r(caseId, requiredDocumentsJson)
), FixtureConsent AS (
  SELECT caseId, 'ACCEPTED' status FROM (VALUES(2),(3),(12),(13),(15)) r(caseId)
), FixtureCaseCheck AS (
  SELECT caseId id, caseId, type, status, CAST('2026-09-10' AS datetime2) updatedAt FROM (VALUES
    (2,'IDENTITY','PENDING'),(4,'ADDRESS','COMPLETED'),(5,'ADDRESS','COMPLETED'),
    (6,'ADDRESS','COMPLETED'),(11,'ADDRESS','PENDING'),(14,'ADDRESS','COMPLETED'),
    (16,'IDENTITY','PENDING'),(17,'ADDRESS','COMPLETED')
  ) r(caseId,type,status)
), FixtureCheckTask AS (
  SELECT 16 checkId, CAST(NULL AS int) assigneeId, 'OPEN' status FROM (VALUES(1),(2)) r(id)
), FixtureFieldVisit AS (
  SELECT caseId, status, CAST('2026-09-10' AS datetime2) updatedAt FROM (VALUES
    (5,'ASSIGNED'),(6,'REVIEW_PENDING'),(14,'CANCELLED')
  ) r(caseId,status)
), FixtureClarification AS (
  SELECT 7 caseId, 'RESPONDED' status, CAST('2026-09-10' AS datetime2) updatedAt
), `;

async function run() {
  const db = new PrismaService(
    new ConfigService({
      ...process.env,
      DB_PORT: Number(process.env.DB_PORT || 1433),
      DB_ENCRYPT: process.env.DB_ENCRYPT !== "false",
      DB_TRUST_SERVER_CERTIFICATE:
        process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
      DB_POOL_MAX: 1,
      DB_POOL_MIN: 0,
    }),
  );
  try {
    const virtual = {
      $queryRaw: (query: Prisma.Sql) => {
        const strings = query.strings.map((part) =>
          part.replace(/\[dbo\]\.\[(\w+)\]/g, "Fixture$1"),
        );
        strings[0] = fixtureSql + strings[0].replace(/^WITH\s+/i, "");
        const template = Object.assign(strings, { raw: [...strings] });
        return db.$queryRaw(Prisma.sql(template, ...query.values));
      },
    } as unknown as PrismaService;
    const service = new OperationsActionsService(virtual);
    const actor = {
      tenantId: 1n,
      branchId: 2n,
      clientId: 3n,
      roles: ["OPS_MANAGER"],
    } as Actor;
    const expected = {
      documents: ["1", "13"],
      start: ["2"],
      checks: ["11"],
      field_assignment: ["4", "11", "14", "17"],
      field_review: ["6"],
      clarifications: ["7"],
    };
    for (const action of operationsActionKinds) {
      const result = await service.get(actor, {
        action,
        page: 1,
        pageSize: 50,
      });
      assert.deepEqual(
        result.items.map((row) => row.id).sort(),
        expected[action].sort(),
        action,
      );
      assert.equal(result.total, expected[action].length, `${action}: total`);
      assert.equal(
        result.summary.find((row) => row.action === action)?.cases,
        result.total,
        `${action}: card/list parity`,
      );
      if (action === "documents")
        assert.equal(
          result.summary[0].quantity,
          3,
          "Count files separately from cases",
        );
    }
    const filtered = await service.get(actor, {
      action: "documents",
      page: 99,
      pageSize: 1,
      search: "CASE-13",
    });
    assert.equal(filtered.total, 1);
    assert.equal(filtered.page, 1);
    assert.equal(filtered.summary[0].cases, 2);
    const crossClient = await service.get(
      { ...actor, clientId: 99n },
      { action: "documents", page: 1, pageSize: 8 },
    );
    assert.equal(crossClient.total, 0);
    console.log(
      "SELECT-only SQL fixtures passed: 6 queues, counts, pagination, latest uploads, intake gates, physical flow, tenant/branch/client isolation.",
    );
  } finally {
    await db.$disconnect();
  }
}

void run().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message.replaceAll(process.env.DB_HOST || "__none__", "[DB host]")
      : "SQL inbox test failed",
  );
  process.exitCode = 1;
});
