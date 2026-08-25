BEGIN TRY

BEGIN TRAN;

ALTER TABLE [dbo].[VerificationCase] ADD [qaReviewerId] BIGINT;
ALTER TABLE [dbo].[VerificationCase] ADD [qaClaimedAt] DATETIME2;
ALTER TABLE [dbo].[CheckTask] ADD [blockerReason] NVARCHAR(1000);
ALTER TABLE [dbo].[CheckTask] ADD [blockedAt] DATETIME2;
ALTER TABLE [dbo].[FieldVisit] ADD [checkInLatitude] DECIMAL(9,6);
ALTER TABLE [dbo].[FieldVisit] ADD [checkInLongitude] DECIMAL(9,6);
ALTER TABLE [dbo].[FieldVisit] ADD [checkInAccuracy] DECIMAL(9,2);
ALTER TABLE [dbo].[FieldVisit] ADD [checkedInAt] DATETIME2;

CREATE NONCLUSTERED INDEX [VerificationCase_tenantId_qaReviewerId_status_idx]
ON [dbo].[VerificationCase]([tenantId], [qaReviewerId], [status]);

ALTER TABLE [dbo].[VerificationCase] ADD CONSTRAINT [VerificationCase_qaReviewerId_fkey]
FOREIGN KEY ([qaReviewerId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
