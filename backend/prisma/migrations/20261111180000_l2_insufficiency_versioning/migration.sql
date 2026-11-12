BEGIN TRY

BEGIN TRAN;

-- AlterTable: Track immutable per-version review state and optional L2 clarification link.
ALTER TABLE [dbo].[DocumentVersion] ADD
    [reviewStatus] VARCHAR(24) NOT NULL CONSTRAINT [DocumentVersion_reviewStatus_df] DEFAULT 'PENDING',
    [reviewNote] NVARCHAR(2000),
    [reviewedById] BIGINT,
    [reviewedAt] DATETIME2,
    [clarificationId] BIGINT;

-- AlterTable: Track L2 insufficiency stages, submitted document version, rejections and re-entry state.
ALTER TABLE [dbo].[Clarification] ADD
    [requestedDocumentType] VARCHAR(48),
    [submittedDocumentId] BIGINT,
    [submittedDocumentVersion] INT,
    [opsReviewedById] BIGINT,
    [opsReviewedAt] DATETIME2,
    [opsReviewNote] NVARCHAR(1000),
    [dataEntryReviewedById] BIGINT,
    [dataEntryReviewedAt] DATETIME2,
    [dataEntryReviewNote] NVARCHAR(1000),
    [reentryCompletedById] BIGINT,
    [reentryCompletedAt] DATETIME2,
    [rejectionCount] INT NOT NULL CONSTRAINT [Clarification_rejectionCount_df] DEFAULT 0,
    [lastRejectedAt] DATETIME2,
    [lastRejectedReason] NVARCHAR(1000);

-- Allow new L2 workflow statuses while preserving existing statuses.
ALTER TABLE [dbo].[Clarification] DROP CONSTRAINT [Clarification_status_ck];
ALTER TABLE [dbo].[Clarification] WITH CHECK ADD CONSTRAINT [Clarification_status_ck]
    CHECK ([status] IN ('OPEN', 'RESPONDED', 'CANDIDATE_SUBMITTED', 'DATA_ENTRY_PENDING', 'RESOLVED', 'EXPIRED'));

-- Deterministic audit-backed backfill inside EXEC() so newly added columns compile safely.
EXEC(N'
WITH LatestVersionAudit AS (
    SELECT
        [ae].[tenantId],
        [ae].[resourcePublicId],
        TRY_CAST(JSON_VALUE([ae].[afterJson], ''$.documentVersion'') AS INT) AS [documentVersion],
        [ae].[action],
        NULLIF(LTRIM(RTRIM(JSON_VALUE([ae].[afterJson], ''$.note''))), N'''') AS [auditNote],
        [ae].[actorUserId],
        COALESCE(
            TRY_CAST(JSON_VALUE([ae].[afterJson], ''$.reviewedAt'') AS DATETIME2),
            [ae].[createdAt]
        ) AS [auditReviewedAt],
        ROW_NUMBER() OVER (
            PARTITION BY
                [ae].[tenantId],
                [ae].[resourcePublicId],
                TRY_CAST(JSON_VALUE([ae].[afterJson], ''$.documentVersion'') AS INT)
            ORDER BY [ae].[createdAt] DESC, [ae].[id] DESC
        ) AS [rn]
    FROM [dbo].[AuditEvent] AS [ae]
    WHERE [ae].[resourceType] = ''document''
      AND [ae].[action] IN (''document.verified'', ''document.rejected'', ''document.reupload_required'')
      AND ISJSON([ae].[afterJson]) = 1
      AND TRY_CAST(JSON_VALUE([ae].[afterJson], ''$.documentVersion'') AS INT) IS NOT NULL
)
UPDATE [dv]
SET
    [dv].[reviewStatus] = CASE
        WHEN [lva].[action] = ''document.verified'' THEN ''VERIFIED''
        WHEN [lva].[action] = ''document.rejected'' THEN ''REJECTED''
        WHEN [lva].[action] = ''document.reupload_required'' THEN ''REUPLOAD_REQUIRED''
        WHEN [dv].[version] < [d].[currentVersion] THEN ''SUPERSEDED''
        WHEN [dv].[version] = [d].[currentVersion]
             AND [d].[status] IN (''VERIFIED'', ''REJECTED'', ''REUPLOAD_REQUIRED'')
             AND (
                 [d].[reviewedAt] IS NOT NULL
                 OR [d].[reviewedById] IS NOT NULL
                 OR NULLIF(LTRIM(RTRIM([d].[reviewNote])), N'''') IS NOT NULL
             )
            THEN [d].[status]
        ELSE ''PENDING''
    END,
    [dv].[reviewNote] = CASE
        WHEN [lva].[action] IS NOT NULL THEN COALESCE(
            [lva].[auditNote],
            CASE WHEN [dv].[version] = [d].[currentVersion] THEN [d].[reviewNote] END
        )
        WHEN [dv].[version] < [d].[currentVersion] THEN NULL
        WHEN [dv].[version] = [d].[currentVersion]
             AND [d].[status] IN (''VERIFIED'', ''REJECTED'', ''REUPLOAD_REQUIRED'')
             AND (
                 [d].[reviewedAt] IS NOT NULL
                 OR [d].[reviewedById] IS NOT NULL
                 OR NULLIF(LTRIM(RTRIM([d].[reviewNote])), N'''') IS NOT NULL
             )
            THEN [d].[reviewNote]
        ELSE NULL
    END,
    [dv].[reviewedById] = CASE
        WHEN [lva].[action] IS NOT NULL THEN COALESCE(
            [lva].[actorUserId],
            CASE WHEN [dv].[version] = [d].[currentVersion] THEN [d].[reviewedById] END
        )
        WHEN [dv].[version] < [d].[currentVersion] THEN NULL
        WHEN [dv].[version] = [d].[currentVersion]
             AND [d].[status] IN (''VERIFIED'', ''REJECTED'', ''REUPLOAD_REQUIRED'')
             AND (
                 [d].[reviewedAt] IS NOT NULL
                 OR [d].[reviewedById] IS NOT NULL
                 OR NULLIF(LTRIM(RTRIM([d].[reviewNote])), N'''') IS NOT NULL
             )
            THEN [d].[reviewedById]
        ELSE NULL
    END,
    [dv].[reviewedAt] = CASE
        WHEN [lva].[action] IS NOT NULL THEN COALESCE(
            [lva].[auditReviewedAt],
            CASE WHEN [dv].[version] = [d].[currentVersion] THEN [d].[reviewedAt] END
        )
        WHEN [dv].[version] < [d].[currentVersion] THEN NULL
        WHEN [dv].[version] = [d].[currentVersion]
             AND [d].[status] IN (''VERIFIED'', ''REJECTED'', ''REUPLOAD_REQUIRED'')
             AND (
                 [d].[reviewedAt] IS NOT NULL
                 OR [d].[reviewedById] IS NOT NULL
                 OR NULLIF(LTRIM(RTRIM([d].[reviewNote])), N'''') IS NOT NULL
             )
            THEN [d].[reviewedAt]
        ELSE NULL
    END
FROM [dbo].[DocumentVersion] AS [dv]
INNER JOIN [dbo].[Document] AS [d]
    ON [d].[id] = [dv].[documentId]
LEFT JOIN [LatestVersionAudit] AS [lva]
    ON [lva].[rn] = 1
   AND [lva].[tenantId] = [d].[tenantId]
   AND [lva].[resourcePublicId] = CAST([d].[publicId] AS VARCHAR(64))
   AND [lva].[documentVersion] = [dv].[version];
');

-- Validate backfilled reviewStatus values and enforce allowed domain.
EXEC(N'
ALTER TABLE [dbo].[DocumentVersion] WITH CHECK ADD CONSTRAINT [DocumentVersion_reviewStatus_ck]
    CHECK ([reviewStatus] IN (''PENDING'', ''VERIFIED'', ''REJECTED'', ''REUPLOAD_REQUIRED'', ''SUPERSEDED''));
');

-- CreateIndex inside EXEC() so newly added columns resolve in the same batch.
EXEC(N'
CREATE NONCLUSTERED INDEX [DocumentVersion_documentId_reviewStatus_idx] ON [dbo].[DocumentVersion]([documentId], [reviewStatus]);
CREATE NONCLUSTERED INDEX [DocumentVersion_clarificationId_idx] ON [dbo].[DocumentVersion]([clarificationId]);
CREATE NONCLUSTERED INDEX [Clarification_tenantId_status_level_idx] ON [dbo].[Clarification]([tenantId], [status], [level]);
CREATE NONCLUSTERED INDEX [Clarification_submittedDocumentId_idx] ON [dbo].[Clarification]([submittedDocumentId]);
');

-- AddForeignKey (NO ACTION on all paths prevents SQL Server multiple cascade path errors)
EXEC(N'
ALTER TABLE [dbo].[DocumentVersion] ADD CONSTRAINT [DocumentVersion_clarificationId_fkey]
    FOREIGN KEY ([clarificationId]) REFERENCES [dbo].[Clarification]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Clarification] ADD CONSTRAINT [Clarification_submittedDocumentId_fkey]
    FOREIGN KEY ([submittedDocumentId]) REFERENCES [dbo].[Document]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
');

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
