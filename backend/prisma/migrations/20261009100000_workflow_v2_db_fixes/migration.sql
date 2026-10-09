BEGIN TRY

BEGIN TRAN;

-- STOP on client instruction stores status STOPPED; the status check must allow it.
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE [name] = 'VerificationCase_status_ck')
    ALTER TABLE [dbo].[VerificationCase] DROP CONSTRAINT [VerificationCase_status_ck];
ALTER TABLE [dbo].[VerificationCase] WITH CHECK ADD CONSTRAINT [VerificationCase_status_ck]
CHECK ([status] IN ('DRAFT','CONSENT_PENDING','DOCUMENT_PENDING','IN_PROGRESS','CLARIFICATION_PENDING','QA_REVIEW','MANAGER_REVIEW','REPORT_PENDING','PAYMENT_PENDING','COMPLETED','CLOSED','CANCELLED','STOPPED'));

-- Data Entry reads case evidence and raises L1 clarifications. Databases that created the
-- DATA_ENTRY role earlier kept a narrower list; keep its existing data-entry:review grant.
UPDATE [dbo].[Role]
SET [permissionsJson] = '["dashboard:read","notification:read","case:read","document:read","clarification:read","clarification:write","data-entry:review"]',
    [updatedAt] = SYSUTCDATETIME()
WHERE [code] = 'DATA_ENTRY' AND [isSystem] = 1;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
