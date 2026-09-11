BEGIN TRY
BEGIN TRAN;

ALTER TABLE [dbo].[VerificationMethodRun] ADD [nextFollowUpAt] DATETIME2;
ALTER TABLE [dbo].[SalesOpportunity] ADD [followUpSequenceStartedAt] DATETIME2, [followUpSequenceStep] INT;
-- Compile constraints after their new columns exist (SQL Server batch binding).
EXEC sp_executesql N'ALTER TABLE [dbo].[SalesOpportunity] ADD CONSTRAINT [SalesOpportunity_sequence_ck] CHECK ([followUpSequenceStep] IS NULL OR [followUpSequenceStep] BETWEEN 0 AND 3);';
ALTER TABLE [dbo].[VerificationCase] ADD [retentionHoldAt] DATETIME2, [retentionHoldReason] NVARCHAR(500);
ALTER TABLE [dbo].[Client] ADD [creditLimit] DECIMAL(18,2), [creditHold] BIT NOT NULL CONSTRAINT [Client_creditHold_df] DEFAULT 0, [creditControlReason] NVARCHAR(500);
EXEC sp_executesql N'ALTER TABLE [dbo].[Client] ADD CONSTRAINT [Client_creditLimit_ck] CHECK ([creditLimit] IS NULL OR [creditLimit] >= 0);';

CREATE TABLE [dbo].[SourceOutreach] (
  [id] BIGINT NOT NULL IDENTITY(1,1), [publicId] UNIQUEIDENTIFIER NOT NULL,
  [methodRunId] BIGINT NOT NULL, [actorUserId] BIGINT NOT NULL,
  [channel] VARCHAR(24) NOT NULL, [outcome] VARCHAR(32) NOT NULL,
  [notes] NVARCHAR(1500) NOT NULL, [occurredAt] DATETIME2 NOT NULL, [nextFollowUpAt] DATETIME2,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [SourceOutreach_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [SourceOutreach_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [SourceOutreach_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
  CONSTRAINT [SourceOutreach_channel_ck] CHECK ([channel] IN ('EMAIL','PHONE','PORTAL','IN_PERSON','OTHER')),
  CONSTRAINT [SourceOutreach_outcome_ck] CHECK ([outcome] IN ('NO_RESPONSE','CONTACTED','INFORMATION_REQUESTED','DECLINED'))
);
CREATE NONCLUSTERED INDEX [SourceOutreach_methodRunId_id_idx] ON [dbo].[SourceOutreach]([methodRunId],[id]);
ALTER TABLE [dbo].[SourceOutreach] ADD CONSTRAINT [SourceOutreach_methodRunId_fkey] FOREIGN KEY ([methodRunId]) REFERENCES [dbo].[VerificationMethodRun]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SourceOutreach] ADD CONSTRAINT [SourceOutreach_actorUserId_fkey] FOREIGN KEY ([actorUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE [dbo].[CrmProposal] (
  [id] BIGINT NOT NULL IDENTITY(1,1), [publicId] UNIQUEIDENTIFIER NOT NULL,
  [opportunityId] BIGINT NOT NULL, [revision] INT NOT NULL,
  [status] VARCHAR(24) NOT NULL CONSTRAINT [CrmProposal_status_df] DEFAULT 'DRAFT',
  [snapshotJson] NVARCHAR(MAX) NOT NULL, [createdById] BIGINT NOT NULL, [approvedById] BIGINT,
  [approvedAt] DATETIME2, [validUntil] DATETIME2 NOT NULL,
  [version] INT NOT NULL CONSTRAINT [CrmProposal_version_df] DEFAULT 1,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [CrmProposal_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [CrmProposal_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [CrmProposal_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
  CONSTRAINT [CrmProposal_opportunityId_revision_key] UNIQUE NONCLUSTERED ([opportunityId],[revision]),
  CONSTRAINT [CrmProposal_status_ck] CHECK ([status] IN ('DRAFT','APPROVED','REJECTED','SENT','ACCEPTED','DECLINED','WITHDRAWN')),
  CONSTRAINT [CrmProposal_version_ck] CHECK ([revision] >= 1 AND [version] >= 1),
  CONSTRAINT [CrmProposal_snapshot_ck] CHECK (ISJSON([snapshotJson]) = 1),
  CONSTRAINT [CrmProposal_approval_ck] CHECK ([status] NOT IN ('APPROVED','SENT','ACCEPTED') OR ([approvedById] IS NOT NULL AND [approvedById] <> [createdById] AND [approvedAt] IS NOT NULL))
);
CREATE NONCLUSTERED INDEX [CrmProposal_opportunityId_createdAt_idx] ON [dbo].[CrmProposal]([opportunityId],[createdAt]);
ALTER TABLE [dbo].[CrmProposal] ADD CONSTRAINT [CrmProposal_opportunityId_fkey] FOREIGN KEY ([opportunityId]) REFERENCES [dbo].[SalesOpportunity]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[CrmProposal] ADD CONSTRAINT [CrmProposal_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[CrmProposal] ADD CONSTRAINT [CrmProposal_approvedById_fkey] FOREIGN KEY ([approvedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE [dbo].[ClientAgreementFile] (
  [id] BIGINT NOT NULL IDENTITY(1,1), [publicId] UNIQUEIDENTIFIER NOT NULL,
  [agreementId] BIGINT NOT NULL, [revision] INT NOT NULL,
  [objectKey] NVARCHAR(600) NOT NULL, [originalName] NVARCHAR(255) NOT NULL, [mimeType] VARCHAR(100) NOT NULL,
  [sizeBytes] INT NOT NULL, [sha256] CHAR(64) NOT NULL,
  [status] VARCHAR(24) NOT NULL CONSTRAINT [ClientAgreementFile_status_df] DEFAULT 'PENDING',
  [uploadedById] BIGINT NOT NULL, [reviewedById] BIGINT, [reviewedAt] DATETIME2, [reviewNotes] NVARCHAR(1000),
  [version] INT NOT NULL CONSTRAINT [ClientAgreementFile_version_df] DEFAULT 1,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [ClientAgreementFile_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT [ClientAgreementFile_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [ClientAgreementFile_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
  CONSTRAINT [ClientAgreementFile_agreementId_revision_key] UNIQUE NONCLUSTERED ([agreementId],[revision]),
  CONSTRAINT [ClientAgreementFile_status_ck] CHECK ([status] IN ('PENDING','APPROVED','REJECTED')),
  CONSTRAINT [ClientAgreementFile_size_ck] CHECK ([sizeBytes] > 0 AND [sizeBytes] <= 10485760),
  CONSTRAINT [ClientAgreementFile_review_ck] CHECK ([status] = 'PENDING' OR ([reviewedById] IS NOT NULL AND [reviewedById] <> [uploadedById] AND [reviewedAt] IS NOT NULL AND [reviewNotes] IS NOT NULL)),
  CONSTRAINT [ClientAgreementFile_version_ck] CHECK ([revision] >= 1 AND [version] >= 1)
);
ALTER TABLE [dbo].[ClientAgreementFile] ADD CONSTRAINT [ClientAgreementFile_agreementId_fkey] FOREIGN KEY ([agreementId]) REFERENCES [dbo].[ClientAgreement]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ClientAgreementFile] ADD CONSTRAINT [ClientAgreementFile_uploadedById_fkey] FOREIGN KEY ([uploadedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ClientAgreementFile] ADD CONSTRAINT [ClientAgreementFile_reviewedById_fkey] FOREIGN KEY ([reviewedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

CREATE TABLE [dbo].[VendorSharingRecord] (
  [id] BIGINT NOT NULL IDENTITY(1,1), [publicId] UNIQUEIDENTIFIER NOT NULL, [tenantId] BIGINT NOT NULL,
  [recipient] NVARCHAR(160) NOT NULL, [purpose] NVARCHAR(1000) NOT NULL,
  [agreementReference] NVARCHAR(300) NOT NULL, [scopeReference] NVARCHAR(200) NOT NULL,
  [categoriesJson] NVARCHAR(500) NOT NULL, [expiresAt] DATETIME2 NOT NULL,
  [status] VARCHAR(24) NOT NULL CONSTRAINT [VendorSharingRecord_status_df] DEFAULT 'PROPOSED',
  [createdById] BIGINT NOT NULL, [decidedById] BIGINT, [decisionReason] NVARCHAR(1000),
  [version] INT NOT NULL CONSTRAINT [VendorSharingRecord_version_df] DEFAULT 1,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [VendorSharingRecord_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [VendorSharingRecord_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [VendorSharingRecord_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
  CONSTRAINT [VendorSharingRecord_status_ck] CHECK ([status] IN ('PROPOSED','AUTHORISED','REJECTED','REVOKED')),
  CONSTRAINT [VendorSharingRecord_categories_ck] CHECK (ISJSON([categoriesJson]) = 1),
  CONSTRAINT [VendorSharingRecord_authority_ck] CHECK ([status] <> 'AUTHORISED' OR ([decidedById] IS NOT NULL AND [decidedById] <> [createdById] AND [decisionReason] IS NOT NULL)),
  CONSTRAINT [VendorSharingRecord_version_ck] CHECK ([version] >= 1)
);
CREATE NONCLUSTERED INDEX [VendorSharingRecord_tenantId_status_expiresAt_idx] ON [dbo].[VendorSharingRecord]([tenantId],[status],[expiresAt]);
ALTER TABLE [dbo].[VendorSharingRecord] ADD CONSTRAINT [VendorSharingRecord_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[VendorSharingRecord] ADD CONSTRAINT [VendorSharingRecord_createdById_fkey] FOREIGN KEY ([createdById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[VendorSharingRecord] ADD CONSTRAINT [VendorSharingRecord_decidedById_fkey] FOREIGN KEY ([decidedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
