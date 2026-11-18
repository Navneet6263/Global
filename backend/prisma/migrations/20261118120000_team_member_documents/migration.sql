BEGIN TRY

BEGIN TRAN;

IF OBJECT_ID(N'[dbo].[TeamMemberDocument]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[TeamMemberDocument] (
        [id] BIGINT NOT NULL IDENTITY(1,1),
        [publicId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [TeamMemberDocument_publicId_df] DEFAULT NEWID(),
        [tenantId] BIGINT NOT NULL
            CONSTRAINT [TeamMemberDocument_tenantId_fkey] REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
        [userId] BIGINT NOT NULL
            CONSTRAINT [TeamMemberDocument_userId_fkey] REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE NO ACTION,
        [category] VARCHAR(16) NOT NULL,
        [slot] INT NOT NULL CONSTRAINT [TeamMemberDocument_slot_df] DEFAULT 1,
        [storageKey] NVARCHAR(500) NOT NULL,
        [fileName] NVARCHAR(255) NOT NULL,
        [fileSize] INT NOT NULL,
        [mimeType] VARCHAR(100) NOT NULL,
        [sha256] VARCHAR(64) NOT NULL,
        [uploadedById] BIGINT
            CONSTRAINT [TeamMemberDocument_uploadedById_fkey] REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
        [createdAt] DATETIME2 NOT NULL CONSTRAINT [TeamMemberDocument_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT [TeamMemberDocument_pkey] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [TeamMemberDocument_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
        CONSTRAINT [TeamMemberDocument_userId_category_slot_key] UNIQUE NONCLUSTERED ([userId], [category], [slot]),
        CONSTRAINT [TeamMemberDocument_category_ck] CHECK ([category] IN ('IDENTITY', 'AGREEMENT'))
    );

    CREATE NONCLUSTERED INDEX [TeamMemberDocument_tenantId_userId_idx]
        ON [dbo].[TeamMemberDocument]([tenantId], [userId]);
END;

COMMIT TRAN;

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH;
