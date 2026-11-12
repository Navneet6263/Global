import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const prismaDir = join(__dirname, "..", "prisma");
const schemaSqlPath = join(prismaDir, "schema.prisma");
const migrationPath = join(
  prismaDir,
  "migrations",
  "20261111180000_l2_insufficiency_versioning",
  "migration.sql",
);
const rollbackPath = join(
  prismaDir,
  "rollbacks",
  "20261111180000_l2_insufficiency_versioning.rollback.sql",
);
const preflightPath = join(prismaDir, "preflight.ts");

function extractModelBlock(schema: string, modelName: string): string {
  const start = schema.indexOf(`model ${modelName} {`);
  assert.ok(start >= 0, `Model ${modelName} not found in schema.prisma`);
  const end = schema.indexOf("\n}\n", start);
  assert.ok(end > start, `Model ${modelName} closing brace not found`);
  return schema.slice(start, end + 3);
}

void test("Prisma schema defines Phase 1 DocumentVersion and Clarification L2 fields cleanly", () => {
  const schema = readFileSync(schemaSqlPath, "utf8");
  const documentBlock = extractModelBlock(schema, "Document");
  const versionBlock = extractModelBlock(schema, "DocumentVersion");
  const clarificationBlock = extractModelBlock(schema, "Clarification");

  assert.match(documentBlock, /clarificationSubmissions\s+Clarification\[\]/);

  for (const field of [
    /reviewStatus\s+String\s+@default\("PENDING"\)\s+@db\.VarChar\(24\)/,
    /reviewNote\s+String\?\s+@db\.NVarChar\(2000\)/,
    /reviewedById\s+BigInt\?/,
    /reviewedAt\s+DateTime\?\s+@db\.DateTime2/,
    /clarificationId\s+BigInt\?/,
    /clarification\s+Clarification\?.*onDelete:\s*NoAction,\s*onUpdate:\s*NoAction/,
    /@@index\(\[documentId,\s*reviewStatus\]\)/,
    /@@index\(\[clarificationId\]\)/,
  ]) {
    assert.match(versionBlock, field);
  }

  for (const field of [
    /requestedDocumentType\s+String\?\s+@db\.VarChar\(48\)/,
    /submittedDocumentId\s+BigInt\?/,
    /submittedDocumentVersion\s+Int\?/,
    /opsReviewedById\s+BigInt\?/,
    /opsReviewedAt\s+DateTime\?\s+@db\.DateTime2/,
    /opsReviewNote\s+String\?\s+@db\.NVarChar\(1000\)/,
    /dataEntryReviewedById\s+BigInt\?/,
    /dataEntryReviewedAt\s+DateTime\?\s+@db\.DateTime2/,
    /dataEntryReviewNote\s+String\?\s+@db\.NVarChar\(1000\)/,
    /reentryCompletedById\s+BigInt\?/,
    /reentryCompletedAt\s+DateTime\?\s+@db\.DateTime2/,
    /rejectionCount\s+Int\s+@default\(0\)/,
    /lastRejectedAt\s+DateTime\?\s+@db\.DateTime2/,
    /lastRejectedReason\s+String\?\s+@db\.NVarChar\(1000\)/,
    /submittedDocument\s+Document\?.*onDelete:\s*NoAction,\s*onUpdate:\s*NoAction/,
    /submittedVersions\s+DocumentVersion\[\]/,
    /@@index\(\[tenantId,\s*status,\s*level\]\)/,
    /@@index\(\[submittedDocumentId\]\)/,
  ]) {
    assert.match(clarificationBlock, field);
  }
});

void test("forward migration SQL enforces constraints, NO ACTION FKs, and audit-backed backfill", () => {
  const sql = readFileSync(migrationPath, "utf8");

  assert.match(sql, /BEGIN TRY/);
  assert.match(sql, /BEGIN TRAN;/);
  assert.match(sql, /COMMIT TRAN;/);
  assert.match(sql, /ROLLBACK TRAN;/);

  assert.match(
    sql,
    /\[Clarification_status_ck\]\s+CHECK\s+\(\[status\]\s+IN\s+\('OPEN',\s*'RESPONDED',\s*'CANDIDATE_SUBMITTED',\s*'DATA_ENTRY_PENDING',\s*'RESOLVED',\s*'EXPIRED'\)\)/,
  );
  assert.match(
    sql,
    /\[DocumentVersion_reviewStatus_ck\]\s+CHECK\s+\(\[reviewStatus\]\s+IN\s+\(''PENDING'',\s*''VERIFIED'',\s*''REJECTED'',\s*''REUPLOAD_REQUIRED'',\s*''SUPERSEDED''\)\)/,
  );

  // Backfill must never copy VERIFIED/REJECTED to unaudited historical versions.
  assert.match(sql, /WHEN \[dv\]\.\[version\] < \[d\]\.\[currentVersion\] THEN ''SUPERSEDED''/);
  assert.match(sql, /ELSE ''PENDING''/);
  assert.match(sql, /ISJSON\(\[ae\]\.\[afterJson\]\) = 1/);
  assert.match(sql, /\[ae\]\.\[resourceType\] = ''document''/);

  // Cross-table FKs must keep NO ACTION on delete/update for SQL Server cascade safety.
  assert.match(
    sql,
    /\[DocumentVersion_clarificationId_fkey\]\s+FOREIGN KEY \(\[clarificationId\]\) REFERENCES \[dbo\]\.\[Clarification\]\(\[id\]\) ON DELETE NO ACTION ON UPDATE NO ACTION/,
  );
  assert.match(
    sql,
    /\[Clarification_submittedDocumentId_fkey\]\s+FOREIGN KEY \(\[submittedDocumentId\]\) REFERENCES \[dbo\]\.\[Document\]\(\[id\]\) ON DELETE NO ACTION ON UPDATE NO ACTION/,
  );

  // reviewStatus constraint must be added AFTER backfill runs.
  assert.ok(
    sql.indexOf("UPDATE [dv]") < sql.indexOf("DocumentVersion_reviewStatus_ck"),
    "DocumentVersion_reviewStatus_ck must run after deterministic backfill",
  );
});

void test("rollback SQL guards Phase 2+ statuses and cleanly reverts all schema objects", () => {
  const sql = readFileSync(rollbackPath, "utf8");

  assert.match(sql, /BEGIN TRY/);
  assert.match(sql, /BEGIN TRAN;/);
  assert.match(sql, /WHERE \[status\] IN \('CANDIDATE_SUBMITTED', 'DATA_ENTRY_PENDING'\)/);
  assert.match(sql, /THROW 51000/);

  for (const dropped of [
    "DocumentVersion_clarificationId_fkey",
    "Clarification_submittedDocumentId_fkey",
    "DocumentVersion_documentId_reviewStatus_idx",
    "DocumentVersion_clarificationId_idx",
    "Clarification_tenantId_status_level_idx",
    "Clarification_submittedDocumentId_idx",
    "DocumentVersion_reviewStatus_ck",
    "Clarification_status_ck",
    "DocumentVersion_reviewStatus_df",
    "Clarification_rejectionCount_df",
  ]) {
    assert.ok(sql.includes(dropped), `Rollback script must handle ${dropped}`);
  }

  assert.match(
    sql,
    /CHECK\s+\(\[status\]\s+IN\s+\('OPEN',\s*'RESPONDED',\s*'RESOLVED',\s*'EXPIRED'\)\)/,
  );
  assert.ok(
    sql.indexOf("DocumentVersion_reviewStatus_df") <
      sql.indexOf("DROP COLUMN\r\n            [reviewStatus]") ||
      sql.indexOf("DocumentVersion_reviewStatus_df") <
        sql.indexOf("DROP COLUMN\n            [reviewStatus]"),
    "Default constraint must drop before dropping column",
  );
});

void test("preflight domain check allows new Clarification L2 statuses", () => {
  const preflight = readFileSync(preflightPath, "utf8");
  for (const status of [
    "OPEN",
    "RESPONDED",
    "CANDIDATE_SUBMITTED",
    "DATA_ENTRY_PENDING",
    "RESOLVED",
    "EXPIRED",
  ]) {
    assert.ok(
      preflight.includes(`"${status}"`),
      `preflight.ts missing Clarification status ${status}`,
    );
  }
});
