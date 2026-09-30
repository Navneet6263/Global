BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[VendorReport] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [assignmentId] BIGINT NOT NULL,
    [version] INT NOT NULL,
    [objectKey] NVARCHAR(600) NOT NULL,
    [originalName] NVARCHAR(255) NOT NULL,
    [contentType] VARCHAR(100) NOT NULL,
    [sizeBytes] INT NOT NULL,
    [sha256] CHAR(64) NOT NULL,
    [uploadedById] BIGINT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VendorReport_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [VendorReport_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [VendorReport_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
    CONSTRAINT [VendorReport_assignmentId_version_key] UNIQUE NONCLUSTERED ([assignmentId],[version])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VendorReport_tenantId_assignmentId_idx] ON [dbo].[VendorReport]([tenantId], [assignmentId]);

-- AddForeignKey
ALTER TABLE [dbo].[VendorReport] ADD CONSTRAINT [VendorReport_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorReport] ADD CONSTRAINT [VendorReport_assignmentId_fkey] FOREIGN KEY ([assignmentId]) REFERENCES [dbo].[VendorAssignment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorReport] ADD CONSTRAINT [VendorReport_uploadedById_fkey] FOREIGN KEY ([uploadedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

-- No role or permission changes. Reports are stored outside case Documents so they never
-- reach candidate, Client Admin or Ops evidence.
-- Rollback (manual): drop the FKs and indexes above, then DROP TABLE [dbo].[VendorReport].
