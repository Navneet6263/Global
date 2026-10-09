BEGIN TRY

BEGIN TRAN;

-- Who sent the check to the vendor (RM / TEAM_LEADER / OPERATIONS). A Team Leader's
-- request waits for the case RM's approval (status PENDING_APPROVAL) with its reason.
ALTER TABLE [dbo].[VendorCheckAssignment] ADD
    [assignedAs] VARCHAR(16) NULL,
    [requestReason] NVARCHAR(1000) NULL,
    [approvedById] BIGINT NULL
        CONSTRAINT [VendorCheckAssignment_approvedById_fkey] REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    [approvedAt] DATETIME2 NULL,
    [approvalNote] NVARCHAR(1000) NULL;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
