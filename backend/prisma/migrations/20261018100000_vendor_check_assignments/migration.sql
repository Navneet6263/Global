BEGIN TRY

BEGIN TRAN;

-- Vendor / field work on a whole check (BGV process step 9), next to the document-level flow.
CREATE TABLE [dbo].[VendorCheckAssignment] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [VendorCheckAssignment_publicId_df] DEFAULT newid(),
    [tenantId] BIGINT NOT NULL,
    [clientId] BIGINT NOT NULL
        CONSTRAINT [VendorCheckAssignment_clientId_fkey] REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    [caseId] BIGINT NOT NULL
        CONSTRAINT [VendorCheckAssignment_caseId_fkey] REFERENCES [dbo].[VerificationCase]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    [checkId] BIGINT NOT NULL
        CONSTRAINT [VendorCheckAssignment_checkId_fkey] REFERENCES [dbo].[CaseCheck]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    [vendorUserId] BIGINT NOT NULL
        CONSTRAINT [VendorCheckAssignment_vendorUserId_fkey] REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    [handlerUserId] BIGINT
        CONSTRAINT [VendorCheckAssignment_handlerUserId_fkey] REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    [assignedById] BIGINT NOT NULL
        CONSTRAINT [VendorCheckAssignment_assignedById_fkey] REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    [reviewedById] BIGINT
        CONSTRAINT [VendorCheckAssignment_reviewedById_fkey] REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    [attempt] INT NOT NULL,
    [status] VARCHAR(16) NOT NULL CONSTRAINT [VendorCheckAssignment_status_df] DEFAULT 'ASSIGNED'
        CONSTRAINT [VendorCheckAssignment_status_ck] CHECK ([status] IN ('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'RETURNED', 'APPROVED', 'DECLINED', 'CANCELLED')),
    [dueAt] DATETIME2,
    [note] NVARCHAR(1000),
    [sharedDocumentsJson] NVARCHAR(max) NOT NULL CONSTRAINT [VendorCheckAssignment_sharedDocumentsJson_df] DEFAULT '[]',
    [submissionJson] NVARCHAR(max),
    [result] VARCHAR(24)
        CONSTRAINT [VendorCheckAssignment_result_ck] CHECK ([result] IS NULL OR [result] IN ('CLEAR', 'DISCREPANCY', 'UNABLE_TO_VERIFY')),
    [remarks] NVARCHAR(2000),
    [declineReason] NVARCHAR(1000),
    [reviewNote] NVARCHAR(1000),
    [acceptedAt] DATETIME2,
    [submittedAt] DATETIME2,
    [reviewedAt] DATETIME2,
    [lastRemindedAt] DATETIME2,
    [version] INT NOT NULL CONSTRAINT [VendorCheckAssignment_version_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VendorCheckAssignment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [VendorCheckAssignment_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [VendorCheckAssignment_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
    CONSTRAINT [VendorCheckAssignment_checkId_attempt_key] UNIQUE NONCLUSTERED ([checkId], [attempt])
);
CREATE NONCLUSTERED INDEX [VendorCheckAssignment_tenantId_vendorUserId_status_idx] ON [dbo].[VendorCheckAssignment]([tenantId], [vendorUserId], [status]);
CREATE NONCLUSTERED INDEX [VendorCheckAssignment_tenantId_status_dueAt_idx] ON [dbo].[VendorCheckAssignment]([tenantId], [status], [dueAt]);
CREATE NONCLUSTERED INDEX [VendorCheckAssignment_caseId_idx] ON [dbo].[VendorCheckAssignment]([caseId]);

-- Proof the vendor uploads with its result (photos, letters, court copies...)
CREATE TABLE [dbo].[VendorCheckEvidence] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [VendorCheckEvidence_publicId_df] DEFAULT newid(),
    [tenantId] BIGINT NOT NULL,
    [assignmentId] BIGINT NOT NULL
        CONSTRAINT [VendorCheckEvidence_assignmentId_fkey] REFERENCES [dbo].[VendorCheckAssignment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    [objectKey] NVARCHAR(600) NOT NULL,
    [originalName] NVARCHAR(255) NOT NULL,
    [contentType] VARCHAR(100) NOT NULL,
    [sizeBytes] INT NOT NULL,
    [sha256] CHAR(64) NOT NULL,
    [uploadedById] BIGINT NOT NULL
        CONSTRAINT [VendorCheckEvidence_uploadedById_fkey] REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VendorCheckEvidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [VendorCheckEvidence_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [VendorCheckEvidence_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);
CREATE NONCLUSTERED INDEX [VendorCheckEvidence_assignmentId_idx] ON [dbo].[VendorCheckEvidence]([assignmentId]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
