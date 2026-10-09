BEGIN TRY

BEGIN TRAN;

-- Client scheduled MIS (daily / weekly / monthly report presets by email)
CREATE TABLE [dbo].[ClientMisSchedule] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [ClientMisSchedule_publicId_df] DEFAULT newid(),
    [tenantId] BIGINT NOT NULL,
    [clientId] BIGINT NOT NULL
        CONSTRAINT [ClientMisSchedule_clientId_fkey] REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    [preset] VARCHAR(24) NOT NULL
        CONSTRAINT [ClientMisSchedule_preset_ck] CHECK ([preset] IN ('CASE_STATUS', 'TAT', 'UTV', 'DISCREPANCY')),
    [frequency] VARCHAR(12) NOT NULL
        CONSTRAINT [ClientMisSchedule_frequency_ck] CHECK ([frequency] IN ('DAILY', 'WEEKLY', 'MONTHLY')),
    [recipientsJson] NVARCHAR(2000) NOT NULL CONSTRAINT [ClientMisSchedule_recipientsJson_df] DEFAULT '[]',
    [nextRunAt] DATETIME2 NOT NULL,
    [lastRunAt] DATETIME2,
    [active] BIT NOT NULL CONSTRAINT [ClientMisSchedule_active_df] DEFAULT 1,
    [createdById] BIGINT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ClientMisSchedule_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ClientMisSchedule_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ClientMisSchedule_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);
CREATE NONCLUSTERED INDEX [ClientMisSchedule_tenantId_nextRunAt_idx] ON [dbo].[ClientMisSchedule]([tenantId], [nextRunAt]);
CREATE NONCLUSTERED INDEX [ClientMisSchedule_clientId_idx] ON [dbo].[ClientMisSchedule]([clientId]);

-- Custom roles: a named variant of a system role with a narrower permission set
ALTER TABLE [dbo].[Role] ADD [baseRoleCode] VARCHAR(48);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
