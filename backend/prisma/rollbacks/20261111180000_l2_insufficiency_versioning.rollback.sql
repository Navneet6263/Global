-- Rollback script for migration: 20261111180000_l2_insufficiency_versioning
--
-- Recovery procedure:
-- 1. Put application workers/API in maintenance mode so no new writes land during schema revert.
-- 2. Take a pre-rollback snapshot/export of any post-migration data in [dbo].[Clarification]
--    and [dbo].[DocumentVersion] if Phases 2-4 have already executed in that environment.
-- 3. If any Clarification rows currently have status IN ('CANDIDATE_SUBMITTED', 'DATA_ENTRY_PENDING'),
--    this script fails closed before modifying constraints. Archive/transition those rows first
--    (for example, back to 'RESPONDED' or 'OPEN' per incident triage) before re-running rollback.
-- 4. Execute this transactional script against the target SQL Server database.
-- 5. Sync Prisma migration history after rollback:
--    npx prisma migrate resolve --rolled-back 20261111180000_l2_insufficiency_versioning
--    (If reverting a database backup or resetting schema state prior to deploy, remove or archive
--     only the matching row in [dbo].[_prisma_migrations] when appropriate.)

BEGIN TRY

BEGIN TRAN;

-- Fail closed if runtime workflows already persisted Phase 2+ Clarification statuses.
IF EXISTS (
    SELECT 1
    FROM [dbo].[Clarification]
    WHERE [status] IN ('CANDIDATE_SUBMITTED', 'DATA_ENTRY_PENDING')
)
BEGIN
    THROW 51000, 'Rollback blocked: Clarification rows exist with status CANDIDATE_SUBMITTED or DATA_ENTRY_PENDING. Remediate those rows before restoring Clarification_status_ck.', 1;
END;

-- Drop foreign keys referencing added columns before dropping indexes/columns.
IF OBJECT_ID('[dbo].[DocumentVersion_clarificationId_fkey]', 'F') IS NOT NULL
    ALTER TABLE [dbo].[DocumentVersion] DROP CONSTRAINT [DocumentVersion_clarificationId_fkey];

IF OBJECT_ID('[dbo].[Clarification_submittedDocumentId_fkey]', 'F') IS NOT NULL
    ALTER TABLE [dbo].[Clarification] DROP CONSTRAINT [Clarification_submittedDocumentId_fkey];

-- Drop indexes created by the forward migration.
DROP INDEX IF EXISTS [DocumentVersion_documentId_reviewStatus_idx] ON [dbo].[DocumentVersion];
DROP INDEX IF EXISTS [DocumentVersion_clarificationId_idx] ON [dbo].[DocumentVersion];
DROP INDEX IF EXISTS [Clarification_tenantId_status_level_idx] ON [dbo].[Clarification];
DROP INDEX IF EXISTS [Clarification_submittedDocumentId_idx] ON [dbo].[Clarification];

-- Drop new reviewStatus check constraint and restore prior Clarification_status_ck constraint.
IF OBJECT_ID('[dbo].[DocumentVersion_reviewStatus_ck]', 'C') IS NOT NULL
    ALTER TABLE [dbo].[DocumentVersion] DROP CONSTRAINT [DocumentVersion_reviewStatus_ck];

IF OBJECT_ID('[dbo].[Clarification_status_ck]', 'C') IS NOT NULL
    ALTER TABLE [dbo].[Clarification] DROP CONSTRAINT [Clarification_status_ck];

ALTER TABLE [dbo].[Clarification] WITH CHECK ADD CONSTRAINT [Clarification_status_ck]
    CHECK ([status] IN ('OPEN', 'RESPONDED', 'RESOLVED', 'EXPIRED'));

-- Drop default constraints before dropping their columns (SQL Server requirement).
IF OBJECT_ID('[dbo].[DocumentVersion_reviewStatus_df]', 'D') IS NOT NULL
    ALTER TABLE [dbo].[DocumentVersion] DROP CONSTRAINT [DocumentVersion_reviewStatus_df];

IF OBJECT_ID('[dbo].[Clarification_rejectionCount_df]', 'D') IS NOT NULL
    ALTER TABLE [dbo].[Clarification] DROP CONSTRAINT [Clarification_rejectionCount_df];

-- Drop added columns from DocumentVersion while preserving all existing rows and original columns.
IF COL_LENGTH('[dbo].[DocumentVersion]', 'reviewStatus') IS NOT NULL
BEGIN
    EXEC(N'
        ALTER TABLE [dbo].[DocumentVersion] DROP COLUMN
            [reviewStatus],
            [reviewNote],
            [reviewedById],
            [reviewedAt],
            [clarificationId];
    ');
END;

-- Drop added columns from Clarification while preserving all existing rows and original columns.
IF COL_LENGTH('[dbo].[Clarification]', 'requestedDocumentType') IS NOT NULL
BEGIN
    EXEC(N'
        ALTER TABLE [dbo].[Clarification] DROP COLUMN
            [requestedDocumentType],
            [submittedDocumentId],
            [submittedDocumentVersion],
            [opsReviewedById],
            [opsReviewedAt],
            [opsReviewNote],
            [dataEntryReviewedById],
            [dataEntryReviewedAt],
            [dataEntryReviewNote],
            [reentryCompletedById],
            [reentryCompletedAt],
            [rejectionCount],
            [lastRejectedAt],
            [lastRejectedReason];
    ');
END;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
