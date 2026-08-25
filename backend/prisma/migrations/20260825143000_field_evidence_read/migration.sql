BEGIN TRY

BEGIN TRAN;

UPDATE [dbo].[Role]
SET [permissionsJson] = JSON_MODIFY([permissionsJson], 'append $', 'field-evidence:read')
WHERE [code] IN ('OPS_MANAGER', 'QA_REVIEWER', 'FIELD_EXECUTIVE')
  AND NOT EXISTS (
    SELECT 1 FROM OPENJSON([permissionsJson])
    WHERE [value] = 'field-evidence:read'
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
