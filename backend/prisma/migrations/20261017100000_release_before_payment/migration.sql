BEGIN TRY

BEGIN TRAN;

-- Reports release after QC / manager approval; billing is monthly. OFF = wait for full payment.
ALTER TABLE [dbo].[TenantAccessPolicy] ADD [releaseBeforePayment] BIT NOT NULL
    CONSTRAINT [TenantAccessPolicy_releaseBeforePayment_df] DEFAULT 1;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
