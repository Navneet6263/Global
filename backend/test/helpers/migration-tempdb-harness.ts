import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const prismaDir = join(__dirname, "..", "..", "prisma");
const pkgRequire = createRequire(join(__dirname, "..", "..", "package.json"));

export interface TempdbSession {
  batch<T = Record<string, unknown>>(sqlText: string): Promise<T[]>;
  close(): Promise<void>;
}

interface MssqlPoolLike {
  connect(): Promise<MssqlPoolLike>;
  close(): Promise<void>;
  request(): {
    batch<T>(sqlText: string): Promise<{ recordset?: T[] }>;
  };
}

export async function openTempdbSession(): Promise<TempdbSession> {
  const required = (name: string): string => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is required`);
    return value;
  };
  const mssql = pkgRequire("mssql") as {
    ConnectionPool: new (config: Record<string, unknown>) => MssqlPoolLike;
  };
  const pool = new mssql.ConnectionPool({
    server: required("DB_HOST"),
    port: Number(process.env.DB_PORT ?? 1433),
    database: required("DB_NAME"),
    user: required("DB_USER"),
    password: required("DB_PASSWORD"),
    options: {
      encrypt: process.env.DB_ENCRYPT !== "false",
      trustServerCertificate:
        process.env.DB_TRUST_SERVER_CERTIFICATE === "true",
    },
    pool: { max: 1, min: 1 },
  });
  await pool.connect();
  return {
    async batch<T = Record<string, unknown>>(sqlText: string): Promise<T[]> {
      const result = await pool.request().batch<T>(sqlText);
      return result.recordset ?? [];
    },
    async close(): Promise<void> {
      await pool.close();
    },
  };
}

export function loadMigrationSql(): string {
  return readFileSync(
    join(
      prismaDir,
      "migrations",
      "20261111180000_l2_insufficiency_versioning",
      "migration.sql",
    ),
    "utf8",
  );
}

export function loadRollbackSql(): string {
  return readFileSync(
    join(
      prismaDir,
      "rollbacks",
      "20261111180000_l2_insufficiency_versioning.rollback.sql",
    ),
    "utf8",
  );
}

const CONSTRAINTS = [
  "DocumentVersion_reviewStatus_df",
  "DocumentVersion_reviewStatus_ck",
  "DocumentVersion_documentId_reviewStatus_idx",
  "DocumentVersion_clarificationId_idx",
  "Clarification_rejectionCount_df",
  "Clarification_status_ck",
  "Clarification_tenantId_status_level_idx",
  "Clarification_submittedDocumentId_idx",
];

/** Rewrites dbo table & constraint identifiers to session-local #temp objects in tempdb. */
export function adaptMigrationForTempdb(sqlText: string, suffix: string): string {
  // SQL Server disallows FOREIGN KEY constraints on #temp tables; strip only the trailing FK block.
  const fkStart = sqlText.indexOf("-- AddForeignKey");
  const commitIdx = sqlText.indexOf("COMMIT TRAN;");
  let rewritten =
    fkStart >= 0 && commitIdx > fkStart
      ? sqlText.slice(0, fkStart) + sqlText.slice(commitIdx)
      : sqlText;

  for (const name of CONSTRAINTS) {
    rewritten = rewritten.replaceAll(`[${name}]`, `[${name}_${suffix}]`);
  }
  return rewritten
    .replaceAll("[dbo].[DocumentVersion]", "#DocumentVersion")
    .replaceAll("[dbo].[Document]", "#Document")
    .replaceAll("[dbo].[Clarification]", "#Clarification")
    .replaceAll("[dbo].[AuditEvent]", "#AuditEvent");
}

/** Rewrites rollback SQL for session-local #temp tables in tempdb. */
export function adaptRollbackForTempdb(sqlText: string, suffix: string): string {
  let rewritten = sqlText
    .replace(
      /IF OBJECT_ID\('\[dbo\]\.\[DocumentVersion_clarificationId_fkey\]', 'F'\)[\s\S]*?Clarification_submittedDocumentId_fkey\];\s*/m,
      "",
    )
    .replaceAll(
      "COL_LENGTH('[dbo].[DocumentVersion]'",
      "COL_LENGTH('tempdb..#DocumentVersion'",
    )
    .replaceAll(
      "COL_LENGTH('[dbo].[Clarification]'",
      "COL_LENGTH('tempdb..#Clarification'",
    )
    .replaceAll("OBJECT_ID('[dbo].[", "OBJECT_ID('tempdb.dbo.[");

  for (const name of CONSTRAINTS) {
    rewritten = rewritten.replaceAll(`[${name}]`, `[${name}_${suffix}]`);
  }
  return rewritten
    .replaceAll("[dbo].[DocumentVersion]", "#DocumentVersion")
    .replaceAll("[dbo].[Document]", "#Document")
    .replaceAll("[dbo].[Clarification]", "#Clarification");
}

export function preMigrationTempSchemaSql(suffix: string): string {
  return `
    CREATE TABLE #Document (
        [id] BIGINT NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [publicId] UNIQUEIDENTIFIER NOT NULL,
        [tenantId] BIGINT NOT NULL,
        [caseId] BIGINT NOT NULL,
        [type] VARCHAR(48) NOT NULL,
        [status] VARCHAR(24) NOT NULL,
        [currentVersion] INT NOT NULL,
        [reviewNote] NVARCHAR(2000) NULL,
        [reviewedAt] DATETIME2 NULL,
        [reviewedById] BIGINT NULL
    );

    CREATE TABLE #DocumentVersion (
        [id] BIGINT NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [documentId] BIGINT NOT NULL,
        [version] INT NOT NULL,
        [objectKey] NVARCHAR(500) NOT NULL,
        [originalName] NVARCHAR(255) NOT NULL,
        [contentType] VARCHAR(100) NOT NULL,
        [sizeBytes] BIGINT NOT NULL,
        [sha256] CHAR(64) NOT NULL,
        [malwareState] VARCHAR(24) NOT NULL DEFAULT 'CLEAN',
        [uploadedById] BIGINT NULL,
        [createdAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

    CREATE TABLE #Clarification (
        [id] BIGINT NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [publicId] UNIQUEIDENTIFIER NOT NULL,
        [tenantId] BIGINT NOT NULL,
        [caseId] BIGINT NOT NULL,
        [checkId] BIGINT NULL,
        [checkCycle] INT NULL,
        [status] VARCHAR(24) NOT NULL DEFAULT 'OPEN',
        [subject] NVARCHAR(180) NOT NULL,
        [level] VARCHAR(8) NULL,
        [raisedById] BIGINT NULL,
        [createdAt] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    ALTER TABLE #Clarification WITH CHECK ADD CONSTRAINT [Clarification_status_ck_${suffix}]
        CHECK ([status] IN ('OPEN', 'RESPONDED', 'RESOLVED', 'EXPIRED'));

    CREATE TABLE #AuditEvent (
        [id] BIGINT NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [tenantId] BIGINT NOT NULL,
        [actorUserId] BIGINT NULL,
        [action] VARCHAR(64) NOT NULL,
        [resourceType] VARCHAR(64) NOT NULL,
        [resourcePublicId] VARCHAR(64) NOT NULL,
        [afterJson] NVARCHAR(MAX) NULL,
        [createdAt] DATETIME2 NOT NULL
    );
  `;
}

export const SAMPLE_DOC_IDS = {
  auditedMulti: "11111111-1111-4111-8111-111111111111",
  fallbackParent: "22222222-2222-4222-8222-222222222222",
  unverifiedClaim: "33333333-3333-4333-8333-333333333333",
  activeAvailable: "44444444-4444-4444-8444-444444444444",
  reuploadPending: "55555555-5555-4555-8555-555555555555",
} as const;
