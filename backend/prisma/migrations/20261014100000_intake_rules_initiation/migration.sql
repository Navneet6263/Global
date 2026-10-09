BEGIN TRY

BEGIN TRAN;

-- Client intake rules: default Data Entry user (auto-assignment) and Route A (client reviews first)
ALTER TABLE [dbo].[Client] ADD [defaultDataEntryUserId] BIGINT NULL
    CONSTRAINT [Client_defaultDataEntryUserId_fkey] REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Client] ADD [clientReviewFirst] BIT NOT NULL
    CONSTRAINT [Client_clientReviewFirst_df] DEFAULT 0;

-- Check-wise initiation captured by Data Entry
ALTER TABLE [dbo].[CaseCheck] ADD [initiationJson] NVARCHAR(max);
ALTER TABLE [dbo].[CaseCheck] ADD [initiatedAt] DATETIME2;
ALTER TABLE [dbo].[CaseCheck] ADD [initiatedById] BIGINT;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
