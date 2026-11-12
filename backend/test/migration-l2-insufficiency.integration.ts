import { config as loadEnv } from "dotenv";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { test } from "node:test";
import {
  SAMPLE_DOC_IDS,
  type TempdbSession,
  adaptMigrationForTempdb,
  adaptRollbackForTempdb,
  loadMigrationSql,
  loadRollbackSql,
  openTempdbSession,
  preMigrationTempSchemaSql,
} from "./helpers/migration-tempdb-harness";

loadEnv({ path: join(__dirname, "..", ".env") });

interface VersionRow {
  documentId: string;
  version: number;
  reviewStatus: string;
  reviewNote: string | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
}

interface RollbackStats {
  dvCols: number;
  clCols: number;
  preservedVersions: number;
  preservedClarifications: number;
}

async function seedPreMigrationFixtures(session: TempdbSession): Promise<void> {
  await session.batch(`
    INSERT INTO #Document ([publicId], [tenantId], [caseId], [type], [status], [currentVersion], [reviewNote], [reviewedAt], [reviewedById])
    VALUES
      ('${SAMPLE_DOC_IDS.auditedMulti}', 1, 10, 'ADDRESS_PROOF', 'VERIFIED', 3, N'Final copy accepted', '2026-10-03T12:00:00Z', 502),
      ('${SAMPLE_DOC_IDS.fallbackParent}', 1, 11, 'PAN', 'REUPLOAD_REQUIRED', 2, N'Scan cropped at bottom', '2026-10-05T09:30:00Z', 503),
      ('${SAMPLE_DOC_IDS.unverifiedClaim}', 1, 12, 'AADHAAR', 'VERIFIED', 1, N'   ', NULL, NULL),
      ('${SAMPLE_DOC_IDS.activeAvailable}', 1, 13, 'EDUCATION_CERTIFICATE', 'AVAILABLE', 1, NULL, NULL, NULL),
      ('${SAMPLE_DOC_IDS.reuploadPending}', 1, 14, 'EMPLOYMENT_PROOF', 'AVAILABLE', 2, NULL, NULL, NULL);

    INSERT INTO #DocumentVersion ([documentId], [version], [objectKey], [originalName], [contentType], [sizeBytes], [sha256])
    VALUES
      -- Doc 1 (id=1): v1 no audit -> SUPERSEDED; v2 rejected audit -> REJECTED; v3 verified audit -> VERIFIED
      (1, 1, N't/1/d1/v1.pdf', N'old.pdf', 'application/pdf', 1000, REPLICATE('a', 64)),
      (1, 2, N't/1/d1/v2.pdf', N'blurry.pdf', 'application/pdf', 1200, REPLICATE('b', 64)),
      (1, 3, N't/1/d1/v3.pdf', N'clear.pdf', 'application/pdf', 1400, REPLICATE('c', 64)),
      -- Doc 2 (id=2): v1 no audit -> SUPERSEDED; v2 parent metadata fallback -> REUPLOAD_REQUIRED
      (2, 1, N't/1/d2/v1.pdf', N'pan1.pdf', 'application/pdf', 900, REPLICATE('d', 64)),
      (2, 2, N't/1/d2/v2.pdf', N'pan2.pdf', 'application/pdf', 950, REPLICATE('e', 64)),
      -- Doc 3 (id=3): VERIFIED status with blank note/null reviewer and no audit -> PENDING (never inferred)
      (3, 1, N't/1/d3/v1.pdf', N'aadhaar.pdf', 'application/pdf', 800, REPLICATE('f', 64)),
      -- Doc 4 (id=4): Active unreviewed AVAILABLE doc -> PENDING
      (4, 1, N't/1/d4/v1.pdf', N'degree.pdf', 'application/pdf', 1100, REPLICATE('1', 64)),
      -- Doc 5 (id=5): v1 verified audit -> VERIFIED; v2 newly uploaded -> PENDING
      (5, 1, N't/1/d5/v1.pdf', N'rel1.pdf', 'application/pdf', 1050, REPLICATE('2', 64)),
      (5, 2, N't/1/d5/v2.pdf', N'rel2.pdf', 'application/pdf', 1150, REPLICATE('3', 64));

    INSERT INTO #AuditEvent ([tenantId], [actorUserId], [action], [resourceType], [resourcePublicId], [afterJson], [createdAt])
    VALUES
      -- Malformed JSON & unrelated actions must safely be ignored
      (1, 501, 'document.rejected', 'document', '${SAMPLE_DOC_IDS.auditedMulti}', N'not-valid-json', '2026-10-01T08:00:00Z'),
      (1, 501, 'document.previewed', 'document', '${SAMPLE_DOC_IDS.auditedMulti}', N'{"documentVersion":1}', '2026-10-01T08:05:00Z'),
      -- Older v2 reupload_required superseded by later v2 rejected audit event
      (1, 500, 'document.reupload_required', 'document', '${SAMPLE_DOC_IDS.auditedMulti}', N'{"documentVersion":2,"note":"Old reupload"}', '2026-10-02T07:00:00Z'),
      (1, 501, 'document.rejected', 'document', '${SAMPLE_DOC_IDS.auditedMulti}', N'{"documentVersion":2,"note":"Glare on address","reviewedAt":"2026-10-02T10:00:00Z"}', '2026-10-02T10:00:01Z'),
      (1, 502, 'document.verified', 'document', '${SAMPLE_DOC_IDS.auditedMulti}', N'{"documentVersion":3,"note":"All pages verified","reviewedAt":"2026-10-03T12:00:00Z"}', '2026-10-03T12:00:01Z'),
      (1, 504, 'document.verified', 'document', '${SAMPLE_DOC_IDS.reuploadPending}', N'{"documentVersion":1,"note":"Original payslip ok","reviewedAt":"2026-10-04T09:00:00Z"}', '2026-10-04T09:00:01Z');

    INSERT INTO #Clarification ([publicId], [tenantId], [caseId], [status], [subject], [level])
    VALUES
      (NEWID(), 1, 10, 'OPEN', N'L2 insufficient proof', 'L2'),
      (NEWID(), 1, 11, 'RESOLVED', N'Completed thread', 'L1');
  `);
}

void test("SQL Server 2022 tempdb execution validates L2 backfill, CHECK constraints, and rollback", async () => {
  const suffix = randomBytes(4).toString("hex");
  const session = await openTempdbSession();

  try {
    await session.batch(preMigrationTempSchemaSql(suffix));
    await seedPreMigrationFixtures(session);

    // 1. Execute actual forward migration SQL against isolated #temp tables.
    await session.batch(adaptMigrationForTempdb(loadMigrationSql(), suffix));

    const versions = await session.batch<VersionRow>(`
      SELECT [documentId], [version], [reviewStatus], [reviewNote], [reviewedById], [reviewedAt]
      FROM #DocumentVersion
      ORDER BY [documentId], [version]
    `);

    const byKey = new Map(versions.map((r) => [`${r.documentId}:${r.version}`, r]));
    assert.equal(versions.length, 9);

    // Historical without audit -> strictly SUPERSEDED with NULL metadata
    assert.equal(byKey.get("1:1")?.reviewStatus, "SUPERSEDED");
    assert.equal(byKey.get("1:1")?.reviewNote, null);
    assert.equal(byKey.get("1:1")?.reviewedById, null);
    assert.equal(byKey.get("1:1")?.reviewedAt, null);

    // Historical with multiple audits -> picks latest audit action & note
    assert.equal(byKey.get("1:2")?.reviewStatus, "REJECTED");
    assert.equal(byKey.get("1:2")?.reviewNote, "Glare on address");
    assert.equal(String(byKey.get("1:2")?.reviewedById), "501");

    // Current audited -> VERIFIED
    assert.equal(byKey.get("1:3")?.reviewStatus, "VERIFIED");
    assert.equal(byKey.get("1:3")?.reviewNote, "All pages verified");

    // Historical unaudited under REUPLOAD_REQUIRED parent -> SUPERSEDED; current w/ metadata -> REUPLOAD_REQUIRED
    assert.equal(byKey.get("2:1")?.reviewStatus, "SUPERSEDED");
    assert.equal(byKey.get("2:2")?.reviewStatus, "REUPLOAD_REQUIRED");
    assert.equal(byKey.get("2:2")?.reviewNote, "Scan cropped at bottom");

    // VERIFIED doc lacking audit and non-empty review columns -> never inferred, stays PENDING
    assert.equal(byKey.get("3:1")?.reviewStatus, "PENDING");
    assert.equal(byKey.get("3:1")?.reviewedAt, null);

    // Active AVAILABLE doc & newly uploaded v2 -> PENDING while v1 remains VERIFIED
    assert.equal(byKey.get("4:1")?.reviewStatus, "PENDING");
    assert.equal(byKey.get("5:1")?.reviewStatus, "VERIFIED");
    assert.equal(byKey.get("5:2")?.reviewStatus, "PENDING");

    // 2. Validate DocumentVersion_reviewStatus_ck accepts valid values and rejects invalid ones.
    for (const valid of ["PENDING", "VERIFIED", "REJECTED", "REUPLOAD_REQUIRED", "SUPERSEDED"]) {
      await session.batch(`
        UPDATE #DocumentVersion SET [reviewStatus] = '${valid}' WHERE [documentId] = 4 AND [version] = 1
      `);
    }
    await assert.rejects(
      session.batch(`
        UPDATE #DocumentVersion SET [reviewStatus] = 'INVALID_STATUS' WHERE [documentId] = 4 AND [version] = 1
      `),
      /CHECK constraint/i,
    );

    // 3. Validate Clarification_status_ck accepts new L2 statuses and rejects unknown ones.
    await session.batch(`
      INSERT INTO #Clarification ([publicId], [tenantId], [caseId], [status], [subject], [level])
      VALUES
        (NEWID(), 1, 15, 'CANDIDATE_SUBMITTED', N'Sub', 'L2'),
        (NEWID(), 1, 16, 'DATA_ENTRY_PENDING', N'De', 'L2')
    `);
    await assert.rejects(
      session.batch(`
        INSERT INTO #Clarification ([publicId], [tenantId], [caseId], [status], [subject], [level])
        VALUES (NEWID(), 1, 17, 'UNKNOWN_STAGE', N'Bad', 'L2')
      `),
      /CHECK constraint/i,
    );

    // 4. Rollback must block while Phase 2+ statuses exist, then succeed cleanly once remediated.
    const rollbackSql = adaptRollbackForTempdb(loadRollbackSql(), suffix);
    await assert.rejects(session.batch(rollbackSql), /Rollback blocked/i);

    await session.batch(`
      DELETE FROM #Clarification WHERE [status] IN ('CANDIDATE_SUBMITTED', 'DATA_ENTRY_PENDING')
    `);
    await session.batch(rollbackSql);

    const [postRollback] = await session.batch<RollbackStats>(`
      SELECT
        CASE WHEN COL_LENGTH('tempdb..#DocumentVersion', 'reviewStatus') IS NULL THEN 0 ELSE 1 END AS [dvCols],
        CASE WHEN COL_LENGTH('tempdb..#Clarification', 'requestedDocumentType') IS NULL THEN 0 ELSE 1 END AS [clCols],
        (SELECT COUNT(*) FROM #DocumentVersion) AS [preservedVersions],
        (SELECT COUNT(*) FROM #Clarification) AS [preservedClarifications]
    `);
    assert.deepEqual(postRollback, {
      dvCols: 0,
      clCols: 0,
      preservedVersions: 9,
      preservedClarifications: 2,
    });
  } finally {
    await session.close();
  }
});
