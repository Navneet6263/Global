BEGIN TRY

BEGIN TRAN;

-- 1. Alter SignupRequest to support vendor self-signup
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[SignupRequest]') AND name = N'signupType'
)
BEGIN
    ALTER TABLE [dbo].[SignupRequest] ADD
        [signupType] VARCHAR(24) NOT NULL CONSTRAINT [SignupRequest_signupType_df] DEFAULT 'COMPANY',
        [businessType] VARCHAR(48);
END;

-- 2. Create VendorProfile table
IF OBJECT_ID(N'[dbo].[VendorProfile]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[VendorProfile] (
        [id] BIGINT IDENTITY(1,1) NOT NULL,
        [publicId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [VendorProfile_publicId_df] DEFAULT NEWID(),
        [tenantId] BIGINT NOT NULL,
        [vendorUserId] BIGINT NOT NULL,
        [businessName] NVARCHAR(180) NOT NULL,
        [businessType] VARCHAR(48) NOT NULL,
        [registrationNumber] VARCHAR(64),
        [taxId] VARCHAR(32),
        [websiteUrl] VARCHAR(255),
        [operatingAddress] NVARCHAR(500),
        [verificationStatus] VARCHAR(24) NOT NULL CONSTRAINT [VendorProfile_verificationStatus_df] DEFAULT 'PENDING_UPLOAD',
        [rejectionReason] NVARCHAR(1000),
        [reviewedAt] DATETIME2,
        [reviewedById] BIGINT,
        [submittedAt] DATETIME2,
        [authorisedSignatory] BIT NOT NULL,
        [termsAcceptedAt] DATETIME2 NOT NULL,
        [termsVersion] VARCHAR(32) NOT NULL,
        [privacyVersion] VARCHAR(32) NOT NULL,
        [termsAcceptedIp] VARCHAR(64),
        [createdAt] DATETIME2 NOT NULL CONSTRAINT [VendorProfile_createdAt_df] DEFAULT SYSUTCDATETIME(),
        [updatedAt] DATETIME2 NOT NULL,
        CONSTRAINT [VendorProfile_pkey] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [VendorProfile_publicId_key] UNIQUE ([publicId]),
        CONSTRAINT [VendorProfile_vendorUserId_key] UNIQUE ([vendorUserId]),
        CONSTRAINT [VendorProfile_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT [VendorProfile_vendorUserId_fkey] FOREIGN KEY ([vendorUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT [VendorProfile_reviewedById_fkey] FOREIGN KEY ([reviewedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
    );

    CREATE NONCLUSTERED INDEX [VendorProfile_tenantId_verificationStatus_idx]
        ON [dbo].[VendorProfile]([tenantId], [verificationStatus]);
END;

-- 3. Create VendorDocument table
IF OBJECT_ID(N'[dbo].[VendorDocument]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[VendorDocument] (
        [id] BIGINT IDENTITY(1,1) NOT NULL,
        [publicId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [VendorDocument_publicId_df] DEFAULT NEWID(),
        [tenantId] BIGINT NOT NULL,
        [vendorProfileId] BIGINT NOT NULL,
        [documentType] VARCHAR(48) NOT NULL,
        [status] VARCHAR(24) NOT NULL CONSTRAINT [VendorDocument_status_df] DEFAULT 'PENDING',
        [rejectionReason] NVARCHAR(1000),
        [verifiedAt] DATETIME2,
        [verifiedById] BIGINT,
        [createdAt] DATETIME2 NOT NULL CONSTRAINT [VendorDocument_createdAt_df] DEFAULT SYSUTCDATETIME(),
        [updatedAt] DATETIME2 NOT NULL,
        CONSTRAINT [VendorDocument_pkey] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [VendorDocument_publicId_key] UNIQUE ([publicId]),
        CONSTRAINT [VendorDocument_vendorProfileId_documentType_key] UNIQUE ([vendorProfileId], [documentType]),
        CONSTRAINT [VendorDocument_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT [VendorDocument_vendorProfileId_fkey] FOREIGN KEY ([vendorProfileId]) REFERENCES [dbo].[VendorProfile]([id]) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT [VendorDocument_verifiedById_fkey] FOREIGN KEY ([verifiedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
    );

    CREATE NONCLUSTERED INDEX [VendorDocument_tenantId_status_idx]
        ON [dbo].[VendorDocument]([tenantId], [status]);
END;

-- 4. Create VendorDocumentRevision table
IF OBJECT_ID(N'[dbo].[VendorDocumentRevision]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[VendorDocumentRevision] (
        [id] BIGINT IDENTITY(1,1) NOT NULL,
        [publicId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [VendorDocumentRevision_publicId_df] DEFAULT NEWID(),
        [vendorDocumentId] BIGINT NOT NULL,
        [revisionNumber] INT NOT NULL CONSTRAINT [VendorDocumentRevision_revisionNumber_df] DEFAULT 1,
        [storageKey] NVARCHAR(500) NOT NULL,
        [fileName] NVARCHAR(255) NOT NULL,
        [fileSize] INT NOT NULL,
        [mimeType] VARCHAR(100) NOT NULL,
        [uploadedAt] DATETIME2 NOT NULL CONSTRAINT [VendorDocumentRevision_uploadedAt_df] DEFAULT SYSUTCDATETIME(),
        [status] VARCHAR(24) NOT NULL CONSTRAINT [VendorDocumentRevision_status_df] DEFAULT 'PENDING',
        [decisionReason] NVARCHAR(1000),
        [decidedAt] DATETIME2,
        [decidedById] BIGINT,
        CONSTRAINT [VendorDocumentRevision_pkey] PRIMARY KEY CLUSTERED ([id]),
        CONSTRAINT [VendorDocumentRevision_publicId_key] UNIQUE ([publicId]),
        CONSTRAINT [VendorDocumentRevision_vendorDocumentId_fkey] FOREIGN KEY ([vendorDocumentId]) REFERENCES [dbo].[VendorDocument]([id]) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT [VendorDocumentRevision_decidedById_fkey] FOREIGN KEY ([decidedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION
    );

    CREATE NONCLUSTERED INDEX [VendorDocumentRevision_vendorDocumentId_revisionNumber_idx]
        ON [dbo].[VendorDocumentRevision]([vendorDocumentId], [revisionNumber]);
END;

-- 5. Backfill legacy Main Vendors as APPROVED so existing operations remain uninterrupted
EXEC(N'
INSERT INTO [dbo].[VendorProfile] (
    [tenantId], [vendorUserId], [businessName], [businessType],
    [verificationStatus], [authorisedSignatory], [termsAcceptedAt],
    [termsVersion], [privacyVersion], [createdAt], [updatedAt]
)
SELECT
    u.[tenantId],
    u.[id],
    u.[displayName],
    ''PROPRIETORSHIP'',
    ''APPROVED'',
    1,
    u.[createdAt],
    ''LEGACY'',
    ''LEGACY'',
    u.[createdAt],
    u.[updatedAt]
FROM [dbo].[User] u
INNER JOIN [dbo].[UserRole] ur ON ur.[userId] = u.[id]
INNER JOIN [dbo].[Role] r ON r.[id] = ur.[roleId]
LEFT JOIN [dbo].[VendorProfile] vp ON vp.[vendorUserId] = u.[id]
WHERE r.[code] = ''VENDOR''
  AND u.[vendorOwnerId] IS NULL
  AND vp.[id] IS NULL;
');

COMMIT TRAN;

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRAN;
    THROW;
END CATCH;
