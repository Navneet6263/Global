BEGIN TRY

BEGIN TRAN;

-- Per-check options of a package, e.g. {"EDUCATION":{"levels":["GRADUATION"]},
-- "IDENTITY":{"ids":["AADHAAR","PAN"]}}. They decide what the candidate is asked for.
ALTER TABLE [dbo].[ServicePackage] ADD [checkOptionsJson] NVARCHAR(MAX) NOT NULL
    CONSTRAINT [ServicePackage_checkOptionsJson_df] DEFAULT '{}';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
