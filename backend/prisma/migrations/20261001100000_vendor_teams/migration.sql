BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[User] ADD [vendorOwnerId] BIGINT;

-- AlterTable
ALTER TABLE [dbo].[VendorAssignment] ADD [delegatedAt] DATETIME2,
[handlerUserId] BIGINT,
[lastRemindedAt] DATETIME2;

-- CreateTable
CREATE TABLE [dbo].[VendorTeamPolicy] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [vendorUserId] BIGINT NOT NULL,
    [maxActiveUsers] INT NOT NULL CONSTRAINT [VendorTeamPolicy_maxActiveUsers_df] DEFAULT 0,
    [version] INT NOT NULL CONSTRAINT [VendorTeamPolicy_version_df] DEFAULT 1,
    [updatedById] BIGINT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VendorTeamPolicy_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [VendorTeamPolicy_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [VendorTeamPolicy_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
    CONSTRAINT [VendorTeamPolicy_vendorUserId_key] UNIQUE NONCLUSTERED ([vendorUserId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VendorTeamPolicy_tenantId_idx] ON [dbo].[VendorTeamPolicy]([tenantId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_tenantId_vendorOwnerId_status_idx] ON [dbo].[User]([tenantId], [vendorOwnerId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VendorAssignment_tenantId_handlerUserId_status_idx] ON [dbo].[VendorAssignment]([tenantId], [handlerUserId], [status]);

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_vendorOwnerId_fkey] FOREIGN KEY ([vendorOwnerId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorAssignment] ADD CONSTRAINT [VendorAssignment_handlerUserId_fkey] FOREIGN KEY ([handlerUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorTeamPolicy] ADD CONSTRAINT [VendorTeamPolicy_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorTeamPolicy] ADD CONSTRAINT [VendorTeamPolicy_vendorUserId_fkey] FOREIGN KEY ([vendorUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

-- No role or permission changes: VENDOR keeps ["vendor:review","notification:read"].
-- Existing vendors keep vendorOwnerId = NULL (Main Vendors) and have no policy row (limit 0).
-- Rollback (manual): drop the FKs/indexes above, DROP TABLE [dbo].[VendorTeamPolicy],
-- then drop the new VendorAssignment and User columns.
