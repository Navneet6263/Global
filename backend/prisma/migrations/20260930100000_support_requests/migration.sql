BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[SupportRequest] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [requestNumber] VARCHAR(32) NOT NULL,
    [requesterType] VARCHAR(16) NOT NULL,
    [requesterUserId] BIGINT,
    [clientId] BIGINT NOT NULL,
    [caseId] BIGINT,
    [subject] NVARCHAR(160) NOT NULL,
    [message] NVARCHAR(2000) NOT NULL,
    [status] VARCHAR(16) NOT NULL CONSTRAINT [SupportRequest_status_df] DEFAULT 'OPEN',
    [assignedToId] BIGINT,
    [resolutionNote] NVARCHAR(2000),
    [resolvedAt] DATETIME2,
    [version] INT NOT NULL CONSTRAINT [SupportRequest_version_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SupportRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SupportRequest_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SupportRequest_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
    CONSTRAINT [SupportRequest_tenantId_requestNumber_key] UNIQUE NONCLUSTERED ([tenantId],[requestNumber])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SupportRequest_tenantId_status_createdAt_idx] ON [dbo].[SupportRequest]([tenantId], [status], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SupportRequest_tenantId_clientId_createdAt_idx] ON [dbo].[SupportRequest]([tenantId], [clientId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SupportRequest_caseId_idx] ON [dbo].[SupportRequest]([caseId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SupportRequest_requesterUserId_createdAt_idx] ON [dbo].[SupportRequest]([requesterUserId], [createdAt]);

-- AddForeignKey
ALTER TABLE [dbo].[SupportRequest] ADD CONSTRAINT [SupportRequest_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SupportRequest] ADD CONSTRAINT [SupportRequest_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SupportRequest] ADD CONSTRAINT [SupportRequest_caseId_fkey] FOREIGN KEY ([caseId]) REFERENCES [dbo].[VerificationCase]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SupportRequest] ADD CONSTRAINT [SupportRequest_requesterUserId_fkey] FOREIGN KEY ([requesterUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[SupportRequest] ADD CONSTRAINT [SupportRequest_assignedToId_fkey] FOREIGN KEY ([assignedToId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Support desk role: read-only operational visibility plus the support-request inbox (/support).
INSERT INTO [dbo].[Role] ([publicId], [tenantId], [code], [name], [permissionsJson], [isSystem], [updatedAt])
SELECT NEWID(), [t].[id], 'SUPPORT_AGENT', 'SUPPORT_AGENT', '["support:read","support:handle","notification:read"]', 1, SYSUTCDATETIME()
FROM [dbo].[Tenant] AS [t]
WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[Role] AS [r]
    WHERE [r].[tenantId] = [t].[id] AND [r].[code] = 'SUPPORT_AGENT'
);

-- Client Admin may raise support requests; appended so any customised permissions are kept.
UPDATE [dbo].[Role]
SET [permissionsJson] = JSON_MODIFY([permissionsJson], 'append $', 'support:request'), [updatedAt] = SYSUTCDATETIME()
WHERE [code] = 'CLIENT_ADMIN'
  AND NOT EXISTS (
    SELECT 1 FROM OPENJSON([permissionsJson])
    WHERE [value] = 'support:request'
  );

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

-- Rollback (manual): DELETE the SUPPORT_AGENT UserRole/Role rows, remove 'support:request'
-- from CLIENT_ADMIN permissionsJson, then DROP TABLE [dbo].[SupportRequest].
