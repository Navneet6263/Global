BEGIN TRY

BEGIN TRAN;

-- AlterTable: how much discount a client RM may give on each package
ALTER TABLE [dbo].[ServicePackage] ADD [maxRmDiscountPercent] DECIMAL(5,2) NOT NULL
    CONSTRAINT [ServicePackage_maxRmDiscountPercent_df] DEFAULT 0
    CONSTRAINT [ServicePackage_maxRmDiscountPercent_ck] CHECK ([maxRmDiscountPercent] >= 0 AND [maxRmDiscountPercent] <= 100);

-- CreateTable: per-client package discount
CREATE TABLE [dbo].[ClientPackageDiscount] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [clientId] BIGINT NOT NULL,
    [servicePackageId] BIGINT NOT NULL,
    [discountPercent] DECIMAL(5,2) NOT NULL,
    [note] NVARCHAR(300),
    [setById] BIGINT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ClientPackageDiscount_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ClientPackageDiscount_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ClientPackageDiscount_clientId_servicePackageId_key] UNIQUE NONCLUSTERED ([clientId],[servicePackageId]),
    CONSTRAINT [ClientPackageDiscount_discountPercent_ck] CHECK ([discountPercent] >= 0 AND [discountPercent] <= 100)
);

-- AddForeignKey
ALTER TABLE [dbo].[ClientPackageDiscount] ADD CONSTRAINT [ClientPackageDiscount_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[ClientPackageDiscount] ADD CONSTRAINT [ClientPackageDiscount_servicePackageId_fkey] FOREIGN KEY ([servicePackageId]) REFERENCES [dbo].[ServicePackage]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
