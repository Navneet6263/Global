-- Rollback script for migration: 20261117100000_vendor_open_queue
--
-- Recovery procedure:
-- 1. Put the API and workers in maintenance mode so no new writes land during the revert.
-- 2. Export [dbo].[VendorExtraCost] and [dbo].[VendorRate] if they hold real data.
-- 3. This script fails closed while any check is still OPEN or TEAM_REVIEW, or has no vendor:
--    cancel those queue checks (or give them to a vendor) first.
-- 4. Run this transactional script against the target SQL Server database.
-- 5. Sync Prisma migration history:
--    npx prisma migrate resolve --rolled-back 20261117100000_vendor_open_queue

BEGIN TRY

BEGIN TRAN;

IF EXISTS (
    SELECT 1 FROM [dbo].[VendorCheckAssignment]
    WHERE [status] IN ('OPEN', 'TEAM_REVIEW') OR [vendorUserId] IS NULL
)
    THROW 50001, 'Open-queue checks still exist; cancel or assign them before rolling back.', 1;

DROP TABLE [dbo].[VendorExtraCost];
DROP TABLE [dbo].[VendorRate];

ALTER TABLE [dbo].[VendorCheckAssignment] DROP CONSTRAINT [VendorCheckAssignment_status_ck];
ALTER TABLE [dbo].[VendorCheckAssignment] WITH CHECK ADD CONSTRAINT [VendorCheckAssignment_status_ck]
    CHECK ([status] IN ('PENDING_APPROVAL', 'REJECTED', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'RETURNED', 'APPROVED', 'DECLINED', 'CANCELLED'));

ALTER TABLE [dbo].[VendorCheckAssignment] DROP CONSTRAINT [VendorCheckAssignment_teamReviewedById_fkey];
ALTER TABLE [dbo].[VendorCheckAssignment] DROP CONSTRAINT [VendorCheckAssignment_releaseCount_df];
ALTER TABLE [dbo].[VendorCheckAssignment] DROP COLUMN
    [price], [city], [pincode], [pickedAt], [releaseCount], [teamReviewedAt], [teamReviewedById];

DROP INDEX [VendorCheckAssignment_tenantId_vendorUserId_status_idx] ON [dbo].[VendorCheckAssignment];
ALTER TABLE [dbo].[VendorCheckAssignment] ALTER COLUMN [vendorUserId] BIGINT NOT NULL;
CREATE NONCLUSTERED INDEX [VendorCheckAssignment_tenantId_vendorUserId_status_idx]
    ON [dbo].[VendorCheckAssignment]([tenantId], [vendorUserId], [status]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
