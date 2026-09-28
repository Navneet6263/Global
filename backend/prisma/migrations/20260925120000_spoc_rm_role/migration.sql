BEGIN TRY

BEGIN TRAN;

-- View-only central monitoring role. Data is served only by the role-gated /spoc module.
INSERT INTO [dbo].[Role] ([publicId], [tenantId], [code], [name], [permissionsJson], [isSystem], [updatedAt])
SELECT NEWID(), [t].[id], 'SPOC_RM', 'SPOC RM', '["dashboard:read","notification:read"]', 1, SYSUTCDATETIME()
FROM [dbo].[Tenant] AS [t]
WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[Role] AS [r]
    WHERE [r].[tenantId] = [t].[id] AND [r].[code] = 'SPOC_RM'
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
