BEGIN TRY

BEGIN TRAN;

-- Open vendor queue: a check can wait (OPEN) with no vendor until an approved vendor picks it.
DROP INDEX [VendorCheckAssignment_tenantId_vendorUserId_status_idx] ON [dbo].[VendorCheckAssignment];
ALTER TABLE [dbo].[VendorCheckAssignment] ALTER COLUMN [vendorUserId] BIGINT NULL;
CREATE NONCLUSTERED INDEX [VendorCheckAssignment_tenantId_vendorUserId_status_idx]
    ON [dbo].[VendorCheckAssignment]([tenantId], [vendorUserId], [status]);

-- What a vendor sees before picking (payment, city, pincode), when it was picked, how often it
-- was returned to the queue, and the vendor Team Leader's review of a member's work.
ALTER TABLE [dbo].[VendorCheckAssignment] ADD
    [price] DECIMAL(12,2),
    [city] NVARCHAR(120),
    [pincode] VARCHAR(12),
    [pickedAt] DATETIME2,
    [releaseCount] INT NOT NULL CONSTRAINT [VendorCheckAssignment_releaseCount_df] DEFAULT 0,
    [teamReviewedAt] DATETIME2,
    [teamReviewedById] BIGINT
        CONSTRAINT [VendorCheckAssignment_teamReviewedById_fkey] REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- OPEN: in the queue for every approved vendor. TEAM_REVIEW: a member's work with the vendor TL.
ALTER TABLE [dbo].[VendorCheckAssignment] DROP CONSTRAINT [VendorCheckAssignment_status_ck];
ALTER TABLE [dbo].[VendorCheckAssignment] WITH CHECK ADD CONSTRAINT [VendorCheckAssignment_status_ck]
    CHECK ([status] IN ('PENDING_APPROVAL', 'REJECTED', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'TEAM_REVIEW', 'SUBMITTED', 'RETURNED', 'APPROVED', 'DECLINED', 'CANCELLED'));

-- A vendor's extra cost on one check (travel, fees...), explained, decided by the case RM.
CREATE TABLE [dbo].[VendorExtraCost] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [VendorExtraCost_publicId_df] DEFAULT newid(),
    [tenantId] BIGINT NOT NULL
        CONSTRAINT [VendorExtraCost_tenantId_fkey] REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    [assignmentId] BIGINT NOT NULL
        CONSTRAINT [VendorExtraCost_assignmentId_fkey] REFERENCES [dbo].[VendorCheckAssignment]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    [amount] DECIMAL(12,2) NOT NULL
        CONSTRAINT [VendorExtraCost_amount_ck] CHECK ([amount] > 0),
    [reason] NVARCHAR(1000) NOT NULL,
    [status] VARCHAR(16) NOT NULL CONSTRAINT [VendorExtraCost_status_df] DEFAULT 'PENDING'
        CONSTRAINT [VendorExtraCost_status_ck] CHECK ([status] IN ('PENDING', 'APPROVED', 'REJECTED')),
    [createdById] BIGINT NOT NULL
        CONSTRAINT [VendorExtraCost_createdById_fkey] REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    [decidedById] BIGINT
        CONSTRAINT [VendorExtraCost_decidedById_fkey] REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    [decidedAt] DATETIME2,
    [decisionNote] NVARCHAR(1000),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VendorExtraCost_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [VendorExtraCost_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [VendorExtraCost_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);
CREATE NONCLUSTERED INDEX [VendorExtraCost_assignmentId_idx] ON [dbo].[VendorExtraCost]([assignmentId]);

-- The payment for each check type when it goes to the open queue (set by Operations).
CREATE TABLE [dbo].[VendorRate] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [VendorRate_publicId_df] DEFAULT newid(),
    [tenantId] BIGINT NOT NULL
        CONSTRAINT [VendorRate_tenantId_fkey] REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    [checkType] VARCHAR(40) NOT NULL,
    [price] DECIMAL(12,2) NOT NULL
        CONSTRAINT [VendorRate_price_ck] CHECK ([price] >= 0),
    [updatedById] BIGINT
        CONSTRAINT [VendorRate_updatedById_fkey] REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION,
    [version] INT NOT NULL CONSTRAINT [VendorRate_version_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VendorRate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [VendorRate_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [VendorRate_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
    CONSTRAINT [VendorRate_tenantId_checkType_key] UNIQUE NONCLUSTERED ([tenantId], [checkType])
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
