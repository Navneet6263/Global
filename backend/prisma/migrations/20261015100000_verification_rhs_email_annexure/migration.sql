BEGIN TRY

BEGIN TRAN;

-- RHS: what the source confirmed for each check
ALTER TABLE [dbo].[CaseCheck] ADD [verifiedJson] NVARCHAR(max);
ALTER TABLE [dbo].[CaseCheck] ADD [verifiedAt] DATETIME2;
ALTER TABLE [dbo].[CaseCheck] ADD [verifiedById] BIGINT;

-- Employer / university emails with automatic follow-ups
CREATE TABLE [dbo].[SourceEmail] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [SourceEmail_publicId_df] DEFAULT newid(),
    [tenantId] BIGINT NOT NULL,
    [checkId] BIGINT NOT NULL
        CONSTRAINT [SourceEmail_checkId_fkey] REFERENCES [dbo].[CaseCheck]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    [toEmail] VARCHAR(254) NOT NULL,
    [ccEmails] NVARCHAR(1000),
    [subject] NVARCHAR(300) NOT NULL,
    [body] NVARCHAR(max) NOT NULL,
    [attachmentsJson] NVARCHAR(max) NOT NULL CONSTRAINT [SourceEmail_attachmentsJson_df] DEFAULT '[]',
    [maxFollowUps] INT NOT NULL CONSTRAINT [SourceEmail_maxFollowUps_df] DEFAULT 0,
    [followUpsSent] INT NOT NULL CONSTRAINT [SourceEmail_followUpsSent_df] DEFAULT 0,
    [lastSentAt] DATETIME2 NOT NULL,
    [nextFollowUpAt] DATETIME2,
    [stoppedAt] DATETIME2,
    [stopReason] NVARCHAR(300),
    [createdById] BIGINT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SourceEmail_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SourceEmail_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SourceEmail_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);
CREATE NONCLUSTERED INDEX [SourceEmail_tenantId_nextFollowUpAt_idx] ON [dbo].[SourceEmail]([tenantId], [nextFollowUpAt]);
CREATE NONCLUSTERED INDEX [SourceEmail_checkId_idx] ON [dbo].[SourceEmail]([checkId]);

-- Bill validation of the monthly annexure
ALTER TABLE [dbo].[Invoice] ADD [annexureStatus] VARCHAR(16)
    CONSTRAINT [Invoice_annexureStatus_ck] CHECK ([annexureStatus] IN ('PENDING', 'VALIDATED', 'QUERIED'));
ALTER TABLE [dbo].[Invoice] ADD [annexureSentAt] DATETIME2;
ALTER TABLE [dbo].[Invoice] ADD [annexureValidatedAt] DATETIME2;
ALTER TABLE [dbo].[Invoice] ADD [annexureQuery] NVARCHAR(1000);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
