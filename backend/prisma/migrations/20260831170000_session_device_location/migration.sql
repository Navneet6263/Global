ALTER TABLE [dbo].[RefreshSession]
ADD [deviceKey] VARCHAR(64) NULL,
    [locationLabel] NVARCHAR(160) NULL;

ALTER TABLE [dbo].[AuditEvent]
ADD [locationLabel] NVARCHAR(160) NULL;

CREATE NONCLUSTERED INDEX [RefreshSession_userId_deviceKey_revokedAt_idx]
ON [dbo].[RefreshSession]([userId], [deviceKey], [revokedAt]);
