BEGIN TRY

BEGIN TRAN;

-- A routed check waits for its Team Leader's review (TL_REVIEW) before QA.
ALTER TABLE [dbo].[CaseCheck] DROP CONSTRAINT [CaseCheck_status_ck];
ALTER TABLE [dbo].[CaseCheck] WITH CHECK ADD CONSTRAINT [CaseCheck_status_ck]
    CHECK ([status] IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'BLOCKED', 'TL_REVIEW', 'COMPLETED', 'QA_REVIEW'));

-- A Team Leader's vendor request waits for the case RM (PENDING_APPROVAL) or is turned down (REJECTED).
ALTER TABLE [dbo].[VendorCheckAssignment] DROP CONSTRAINT [VendorCheckAssignment_status_ck];
ALTER TABLE [dbo].[VendorCheckAssignment] WITH CHECK ADD CONSTRAINT [VendorCheckAssignment_status_ck]
    CHECK ([status] IN ('PENDING_APPROVAL', 'REJECTED', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'RETURNED', 'APPROVED', 'DECLINED', 'CANCELLED'));

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
