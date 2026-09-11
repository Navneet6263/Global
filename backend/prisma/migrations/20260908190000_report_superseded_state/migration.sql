BEGIN TRY
BEGIN TRAN;

-- Reopening preserves historical files and removes them from current report access.
ALTER TABLE [dbo].[Report] DROP CONSTRAINT [Report_status_ck];
ALTER TABLE [dbo].[Report] WITH CHECK ADD CONSTRAINT [Report_status_ck]
CHECK ([status] IN ('QUEUED', 'PREPARED', 'PUBLISHED', 'FAILED', 'SUPERSEDED'));

COMMIT TRAN;
END TRY
BEGIN CATCH
IF @@TRANCOUNT > 0 ROLLBACK TRAN;
THROW;
END CATCH;
