BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Client] ADD [primaryRmAssignedAt] DATETIME2,
[primaryRmUserId] BIGINT;

-- AlterTable
ALTER TABLE [dbo].[VerificationCase] ADD [stopReason] NVARCHAR(500),
[stoppedAt] DATETIME2,
[stoppedFromStatus] VARCHAR(32);

-- AlterTable
ALTER TABLE [dbo].[CaseCheck] ADD [disposition] VARCHAR(24);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Client_tenantId_primaryRmUserId_idx] ON [dbo].[Client]([tenantId], [primaryRmUserId]);

-- AddForeignKey
ALTER TABLE [dbo].[Client] ADD CONSTRAINT [Client_primaryRmUserId_fkey] FOREIGN KEY ([primaryRmUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

