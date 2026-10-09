BEGIN TRY

BEGIN TRAN;

-- AlterTable: a price per check (for cases that pick fewer checks) and the package GST %
ALTER TABLE [dbo].[ServicePackage] ADD [checkPricesJson] NVARCHAR(max) NOT NULL
    CONSTRAINT [ServicePackage_checkPricesJson_df] DEFAULT '{}';
ALTER TABLE [dbo].[ServicePackage] ADD [taxRate] DECIMAL(5,2) NOT NULL
    CONSTRAINT [ServicePackage_taxRate_df] DEFAULT 18
    CONSTRAINT [ServicePackage_taxRate_ck] CHECK ([taxRate] >= 0 AND [taxRate] <= 100);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
