BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[Client] ADD [onboardingNote] NVARCHAR(500),
[onboardingSubmittedAt] DATETIME2,
[pan] VARCHAR(10),
[selfSignupAt] DATETIME2;

-- AlterTable
ALTER TABLE [dbo].[VerificationCase] ADD [escalatedAt] DATETIME2,
[escalatedById] BIGINT,
[escalationNote] NVARCHAR(500);

-- CreateTable
CREATE TABLE [dbo].[SignupRequest] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [email] VARCHAR(254) NOT NULL,
    [normalizedEmail] VARCHAR(254) NOT NULL,
    [fullName] NVARCHAR(120) NOT NULL,
    [companyName] NVARCHAR(180) NOT NULL,
    [phone] VARCHAR(24),
    [passwordHash] VARCHAR(255) NOT NULL,
    [otpHash] CHAR(64) NOT NULL,
    [otpExpiresAt] DATETIME2 NOT NULL,
    [otpAttempts] INT NOT NULL CONSTRAINT [SignupRequest_otpAttempts_df] DEFAULT 0,
    [sendCount] INT NOT NULL CONSTRAINT [SignupRequest_sendCount_df] DEFAULT 1,
    [lastSentAt] DATETIME2 NOT NULL CONSTRAINT [SignupRequest_lastSentAt_df] DEFAULT CURRENT_TIMESTAMP,
    [status] VARCHAR(16) NOT NULL CONSTRAINT [SignupRequest_status_df] DEFAULT 'PENDING',
    [ipAddress] VARCHAR(64),
    [completedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SignupRequest_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SignupRequest_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SignupRequest_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SignupRequest_tenantId_normalizedEmail_status_idx] ON [dbo].[SignupRequest]([tenantId], [normalizedEmail], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [SignupRequest_status_createdAt_idx] ON [dbo].[SignupRequest]([status], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Client_tenantId_status_selfSignupAt_idx] ON [dbo].[Client]([tenantId], [status], [selfSignupAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VerificationCase_tenantId_escalatedAt_idx] ON [dbo].[VerificationCase]([tenantId], [escalatedAt]);

-- Sign-up lifecycle: PENDING until OTP confirmed, then COMPLETED; abandoned rows EXPIRED.
ALTER TABLE [dbo].[SignupRequest] WITH CHECK ADD CONSTRAINT [SignupRequest_status_ck] CHECK ([status] IN ('PENDING','COMPLETED','EXPIRED'));

-- AddForeignKey
ALTER TABLE [dbo].[SignupRequest] ADD CONSTRAINT [SignupRequest_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VerificationCase] ADD CONSTRAINT [VerificationCase_escalatedById_fkey] FOREIGN KEY ([escalatedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
