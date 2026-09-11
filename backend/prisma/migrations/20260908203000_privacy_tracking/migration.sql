BEGIN TRY
BEGIN TRAN;

CREATE TABLE [dbo].[PrivacyRecord] (
  [id] BIGINT NOT NULL IDENTITY(1,1),
  [publicId] UNIQUEIDENTIFIER NOT NULL,
  [tenantId] BIGINT NOT NULL,
  [kind] VARCHAR(24) NOT NULL,
  [requestType] VARCHAR(24),
  [subjectReference] NVARCHAR(200),
  [title] NVARCHAR(160) NOT NULL,
  [description] NVARCHAR(2000) NOT NULL,
  [status] VARCHAR(24) NOT NULL,
  [severity] VARCHAR(16),
  [dueAt] DATETIME2,
  [resolutionNote] NVARCHAR(2000),
  [evidenceReference] NVARCHAR(300),
  [completedAt] DATETIME2,
  [createdById] BIGINT NOT NULL,
  [updatedById] BIGINT NOT NULL,
  [version] INT NOT NULL CONSTRAINT [PrivacyRecord_version_df] DEFAULT 1,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [PrivacyRecord_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [PrivacyRecord_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [PrivacyRecord_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
  CONSTRAINT [PrivacyRecord_kind_status_ck] CHECK (
    ([kind] = 'DATA_REQUEST' AND [status] IN ('RECEIVED','IN_REVIEW','APPROVED','REJECTED','FULFILLED')) OR
    ([kind] = 'INCIDENT' AND [status] IN ('OPEN','INVESTIGATING','CONTAINED','CLOSED'))
  ),
  CONSTRAINT [PrivacyRecord_request_type_ck] CHECK (
    ([kind] = 'DATA_REQUEST' AND [requestType] IS NOT NULL AND [requestType] IN ('ACCESS','CORRECTION','ERASURE','OTHER') AND [subjectReference] IS NOT NULL AND LEN(LTRIM(RTRIM([subjectReference]))) >= 3 AND [severity] IS NULL) OR
    ([kind] = 'INCIDENT' AND [requestType] IS NULL AND [severity] IS NOT NULL AND [severity] IN ('LOW','MEDIUM','HIGH','CRITICAL'))
  ),
  CONSTRAINT [PrivacyRecord_completion_evidence_ck] CHECK (
    [status] NOT IN ('FULFILLED','CLOSED') OR
    ([evidenceReference] IS NOT NULL AND LEN(LTRIM(RTRIM([evidenceReference]))) >= 3 AND [resolutionNote] IS NOT NULL AND LEN(LTRIM(RTRIM([resolutionNote]))) >= 10 AND [completedAt] IS NOT NULL)
  ),
  CONSTRAINT [PrivacyRecord_version_ck] CHECK ([version] >= 1)
);

CREATE NONCLUSTERED INDEX [PrivacyRecord_tenantId_kind_status_createdAt_idx] ON [dbo].[PrivacyRecord]([tenantId],[kind],[status],[createdAt]);
CREATE NONCLUSTERED INDEX [PrivacyRecord_tenantId_dueAt_idx] ON [dbo].[PrivacyRecord]([tenantId],[dueAt]);
ALTER TABLE [dbo].[PrivacyRecord] ADD CONSTRAINT [PrivacyRecord_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[PrivacyRecord] ADD CONSTRAINT [PrivacyRecord_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[PrivacyRecord] ADD CONSTRAINT [PrivacyRecord_updatedById_fkey] FOREIGN KEY ([updatedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
