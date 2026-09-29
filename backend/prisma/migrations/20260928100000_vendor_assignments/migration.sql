BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[VendorAssignment] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [clientId] BIGINT NOT NULL,
    [caseId] BIGINT NOT NULL,
    [documentId] BIGINT NOT NULL,
    [documentVersion] INT NOT NULL,
    [attempt] INT NOT NULL,
    [vendorUserId] BIGINT NOT NULL,
    [assignedById] BIGINT NOT NULL,
    [assignmentNote] NVARCHAR(1000),
    [resolutionNote] NVARCHAR(1000),
    [status] VARCHAR(24) NOT NULL CONSTRAINT [VendorAssignment_status_df] DEFAULT 'PENDING',
    [decisionReason] NVARCHAR(1000),
    [decidedById] BIGINT,
    [decidedAt] DATETIME2,
    [version] INT NOT NULL CONSTRAINT [VendorAssignment_version_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VendorAssignment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [VendorAssignment_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [VendorAssignment_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
    CONSTRAINT [VendorAssignment_documentId_attempt_key] UNIQUE NONCLUSTERED ([documentId],[attempt])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VendorAssignment_tenantId_vendorUserId_status_createdAt_idx] ON [dbo].[VendorAssignment]([tenantId], [vendorUserId], [status], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VendorAssignment_tenantId_clientId_status_idx] ON [dbo].[VendorAssignment]([tenantId], [clientId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VendorAssignment_caseId_idx] ON [dbo].[VendorAssignment]([caseId]);

-- AddForeignKey
ALTER TABLE [dbo].[VendorAssignment] ADD CONSTRAINT [VendorAssignment_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorAssignment] ADD CONSTRAINT [VendorAssignment_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorAssignment] ADD CONSTRAINT [VendorAssignment_caseId_fkey] FOREIGN KEY ([caseId]) REFERENCES [dbo].[VerificationCase]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorAssignment] ADD CONSTRAINT [VendorAssignment_documentId_fkey] FOREIGN KEY ([documentId]) REFERENCES [dbo].[Document]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorAssignment] ADD CONSTRAINT [VendorAssignment_vendorUserId_fkey] FOREIGN KEY ([vendorUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorAssignment] ADD CONSTRAINT [VendorAssignment_assignedById_fkey] FOREIGN KEY ([assignedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VendorAssignment] ADD CONSTRAINT [VendorAssignment_decidedById_fkey] FOREIGN KEY ([decidedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- External vendor role: sees and decides only the document requests assigned to it (/vendor).
INSERT INTO [dbo].[Role] ([publicId], [tenantId], [code], [name], [permissionsJson], [isSystem], [updatedAt])
SELECT NEWID(), [t].[id], 'VENDOR', 'VENDOR', '["vendor:review","notification:read"]', 1, SYSUTCDATETIME()
FROM [dbo].[Tenant] AS [t]
WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[Role] AS [r]
    WHERE [r].[tenantId] = [t].[id] AND [r].[code] = 'VENDOR'
);

-- SPOC-RM gains exactly one write capability: assigning documents to vendors (/spoc/vendors).
UPDATE [dbo].[Role]
SET [permissionsJson] = '["dashboard:read","notification:read","vendor:assign"]', [updatedAt] = SYSUTCDATETIME()
WHERE [code] = 'SPOC_RM';

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

