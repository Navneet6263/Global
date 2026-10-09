BEGIN TRY

BEGIN TRAN;

-- Branch (office) scoping is OFF until the company runs more than one office.
ALTER TABLE [dbo].[TenantAccessPolicy] ADD [branchScopingEnabled] BIT NOT NULL
    CONSTRAINT [TenantAccessPolicy_branchScopingEnabled_df] DEFAULT 0;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
