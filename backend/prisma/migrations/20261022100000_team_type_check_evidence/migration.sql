BEGIN TRY

BEGIN TRAN;

-- Verification teams are one of four kinds; the verifier sees that team's process only.
ALTER TABLE [dbo].[Department] ADD [teamType] VARCHAR(16) NULL;
EXEC('ALTER TABLE [dbo].[Department] WITH CHECK ADD CONSTRAINT [Department_teamType_ck]
    CHECK ([teamType] IS NULL OR [teamType] IN (''EMPLOYMENT'', ''EDUCATION'', ''VENDOR'', ''DIGITAL''))');
EXEC('UPDATE [dbo].[Department] SET [teamType] = CASE
        WHEN [code] LIKE ''%EDU%'' THEN ''EDUCATION''
        WHEN [code] LIKE ''%VENDOR%'' OR [code] LIKE ''%FIELD%'' THEN ''VENDOR''
        WHEN [code] LIKE ''%ADDRESS%'' OR [code] LIKE ''%DAV%'' OR [code] LIKE ''%DIGITAL%'' THEN ''DIGITAL''
        ELSE ''EMPLOYMENT'' END
    WHERE [kind] = ''VERIFICATION''');

-- Report header: the candidate''s date of joining (Client / Process uses externalRef).
ALTER TABLE [dbo].[VerificationCase] ADD [joiningDate] DATE NULL;

-- Proof a verifier attaches to a check (screenshots, replies, photos) for its annexure.
CREATE TABLE [dbo].[CheckEvidence] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [CheckEvidence_publicId_df] DEFAULT newid(),
    [tenantId] BIGINT NOT NULL,
    [checkId] BIGINT NOT NULL
        CONSTRAINT [CheckEvidence_checkId_fkey] REFERENCES [dbo].[CaseCheck]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    [objectKey] NVARCHAR(600) NOT NULL,
    [originalName] NVARCHAR(255) NOT NULL,
    [contentType] VARCHAR(100) NOT NULL,
    [sizeBytes] INT NOT NULL,
    [sha256] CHAR(64) NOT NULL,
    [caption] NVARCHAR(300) NULL,
    [uploadedById] BIGINT NOT NULL
        CONSTRAINT [CheckEvidence_uploadedById_fkey] REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CheckEvidence_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [CheckEvidence_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CheckEvidence_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);
CREATE NONCLUSTERED INDEX [CheckEvidence_checkId_idx] ON [dbo].[CheckEvidence]([checkId]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
