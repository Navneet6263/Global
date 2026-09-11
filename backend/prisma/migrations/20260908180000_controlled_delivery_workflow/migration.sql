BEGIN TRY

BEGIN TRAN;

-- DropIndex
ALTER TABLE [dbo].[CaseCheck] DROP CONSTRAINT [CaseCheck_caseId_type_key];

-- AlterTable
ALTER TABLE [dbo].[CaseCheck] ADD [caseServiceId] BIGINT,
[reviewCycle] INT NOT NULL CONSTRAINT [CaseCheck_reviewCycle_df] DEFAULT 1;

-- AlterTable
ALTER TABLE [dbo].[Clarification] ADD [reverificationRequired] BIT NOT NULL CONSTRAINT [Clarification_reverificationRequired_df] DEFAULT 1,
[checkCycle] INT;

-- AlterTable
ALTER TABLE [dbo].[Client] ADD [billingAddress] NVARCHAR(500),
[gstin] VARCHAR(15);

-- AlterTable
ALTER TABLE [dbo].[Document] ADD [reviewNote] NVARCHAR(2000),
[reviewedAt] DATETIME2,
[reviewedById] BIGINT,
[version] INT NOT NULL CONSTRAINT [Document_version_df] DEFAULT 1;

-- AlterTable
ALTER TABLE [dbo].[InvoiceLine] ADD [reportId] BIGINT;

-- AlterTable
ALTER TABLE [dbo].[Report] ADD [downloadExpiresAt] DATETIME2,
[managerReviewId] BIGINT,
[releasedAt] DATETIME2,
[releasedById] BIGINT,
[workflowVersion] INT NOT NULL CONSTRAINT [Report_workflowVersion_df] DEFAULT 1;

-- AlterTable
ALTER TABLE [dbo].[ServicePackage] ADD [requiredDocumentsJson] NVARCHAR(max) NOT NULL CONSTRAINT [ServicePackage_requiredDocumentsJson_df] DEFAULT '[]',
[serviceFamily] VARCHAR(32) NOT NULL CONSTRAINT [ServicePackage_serviceFamily_df] DEFAULT 'HIRECHECK';

-- CreateTable
CREATE TABLE [dbo].[ManagerReview] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [caseId] BIGINT NOT NULL,
    [reviewerId] BIGINT NOT NULL,
    [qaReviewId] BIGINT NOT NULL,
    [decision] VARCHAR(24) NOT NULL,
    [notes] NVARCHAR(2000) NOT NULL,
    [snapshotJson] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ManagerReview_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ManagerReview_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ManagerReview_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);

-- CreateTable
CREATE TABLE [dbo].[CaseService] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [caseId] BIGINT NOT NULL,
    [servicePackageId] BIGINT NOT NULL,
    [serviceFamily] VARCHAR(32) NOT NULL,
    [configurationJson] NVARCHAR(max) NOT NULL CONSTRAINT [CaseService_configurationJson_df] DEFAULT '{}',
    [requiredDocumentsJson] NVARCHAR(max) NOT NULL CONSTRAINT [CaseService_requiredDocumentsJson_df] DEFAULT '[]',
    [unitPrice] DECIMAL(18,2) NOT NULL CONSTRAINT [CaseService_unitPrice_df] DEFAULT 0,
    [taxRate] DECIMAL(5,2) NOT NULL CONSTRAINT [CaseService_taxRate_df] DEFAULT 0,
    [tatHours] INT NOT NULL CONSTRAINT [CaseService_tatHours_df] DEFAULT 72,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CaseService_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [CaseService_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CaseService_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
    CONSTRAINT [CaseService_caseId_servicePackageId_key] UNIQUE NONCLUSTERED ([caseId],[servicePackageId])
);

-- CreateTable
CREATE TABLE [dbo].[VerificationMethodRun] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [checkId] BIGINT NOT NULL,
    [method] VARCHAR(24) NOT NULL,
    [status] VARCHAR(24) NOT NULL CONSTRAINT [VerificationMethodRun_status_df] DEFAULT 'REQUESTED',
    [result] VARCHAR(24),
    [provider] NVARCHAR(160),
    [reference] NVARCHAR(180),
    [sourceContact] NVARCHAR(300),
    [requestedAt] DATETIME2 NOT NULL CONSTRAINT [VerificationMethodRun_requestedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [respondedAt] DATETIME2,
    [dueAt] DATETIME2,
    [summary] NVARCHAR(2000),
    [evidenceJson] NVARCHAR(max) NOT NULL CONSTRAINT [VerificationMethodRun_evidenceJson_df] DEFAULT '[]',
    [createdById] BIGINT NOT NULL,
    [version] INT NOT NULL CONSTRAINT [VerificationMethodRun_version_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VerificationMethodRun_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [VerificationMethodRun_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [VerificationMethodRun_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);

-- CreateTable
CREATE TABLE [dbo].[ClientPackageRate] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [clientId] BIGINT NOT NULL,
    [servicePackageId] BIGINT NOT NULL,
    [unitPrice] DECIMAL(18,2) NOT NULL,
    [taxRate] DECIMAL(5,2) NOT NULL CONSTRAINT [ClientPackageRate_taxRate_df] DEFAULT 0,
    [tatHours] INT,
    [active] BIT NOT NULL CONSTRAINT [ClientPackageRate_active_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ClientPackageRate_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ClientPackageRate_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ClientPackageRate_clientId_servicePackageId_key] UNIQUE NONCLUSTERED ([clientId],[servicePackageId])
);

-- CreateTable
CREATE TABLE [dbo].[ClientAgreement] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [clientId] BIGINT NOT NULL,
    [type] VARCHAR(24) NOT NULL,
    [reference] NVARCHAR(500) NOT NULL,
    [signedAt] DATETIME2,
    [expiresAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ClientAgreement_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ClientAgreement_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ClientAgreement_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ManagerReview_caseId_createdAt_idx] ON [dbo].[ManagerReview]([caseId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VerificationMethodRun_checkId_status_idx] ON [dbo].[VerificationMethodRun]([checkId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VerificationMethodRun_status_dueAt_idx] ON [dbo].[VerificationMethodRun]([status], [dueAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ClientAgreement_clientId_type_idx] ON [dbo].[ClientAgreement]([clientId], [type]);

-- CreateIndex
ALTER TABLE [dbo].[CaseCheck] ADD CONSTRAINT [CaseCheck_caseId_caseServiceId_type_key] UNIQUE NONCLUSTERED ([caseId], [caseServiceId], [type]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [InvoiceLine_reportId_idx] ON [dbo].[InvoiceLine]([reportId]);

-- AddForeignKey
ALTER TABLE [dbo].[CaseCheck] ADD CONSTRAINT [CaseCheck_caseServiceId_fkey] FOREIGN KEY ([caseServiceId]) REFERENCES [dbo].[CaseService]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Report] ADD CONSTRAINT [Report_managerReviewId_fkey] FOREIGN KEY ([managerReviewId]) REFERENCES [dbo].[ManagerReview]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[InvoiceLine] ADD CONSTRAINT [InvoiceLine_reportId_fkey] FOREIGN KEY ([reportId]) REFERENCES [dbo].[Report]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ManagerReview] ADD CONSTRAINT [ManagerReview_caseId_fkey] FOREIGN KEY ([caseId]) REFERENCES [dbo].[VerificationCase]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ManagerReview] ADD CONSTRAINT [ManagerReview_reviewerId_fkey] FOREIGN KEY ([reviewerId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ManagerReview] ADD CONSTRAINT [ManagerReview_qaReviewId_fkey] FOREIGN KEY ([qaReviewId]) REFERENCES [dbo].[QaReview]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CaseService] ADD CONSTRAINT [CaseService_caseId_fkey] FOREIGN KEY ([caseId]) REFERENCES [dbo].[VerificationCase]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CaseService] ADD CONSTRAINT [CaseService_servicePackageId_fkey] FOREIGN KEY ([servicePackageId]) REFERENCES [dbo].[ServicePackage]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VerificationMethodRun] ADD CONSTRAINT [VerificationMethodRun_checkId_fkey] FOREIGN KEY ([checkId]) REFERENCES [dbo].[CaseCheck]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ClientPackageRate] ADD CONSTRAINT [ClientPackageRate_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ClientPackageRate] ADD CONSTRAINT [ClientPackageRate_servicePackageId_fkey] FOREIGN KEY ([servicePackageId]) REFERENCES [dbo].[ServicePackage]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ClientAgreement] ADD CONSTRAINT [ClientAgreement_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Expand only the workflow domains introduced by this release. No existing rows are rewritten.
ALTER TABLE [dbo].[Client] DROP CONSTRAINT [Client_status_ck];
ALTER TABLE [dbo].[Client] WITH CHECK ADD CONSTRAINT [Client_status_ck] CHECK ([status] IN ('ONBOARDING','ACTIVE','SUSPENDED'));
ALTER TABLE [dbo].[VerificationCase] DROP CONSTRAINT [VerificationCase_status_ck];
ALTER TABLE [dbo].[VerificationCase] WITH CHECK ADD CONSTRAINT [VerificationCase_status_ck]
CHECK ([status] IN ('DRAFT','CONSENT_PENDING','DOCUMENT_PENDING','IN_PROGRESS','CLARIFICATION_PENDING','QA_REVIEW','MANAGER_REVIEW','REPORT_PENDING','PAYMENT_PENDING','COMPLETED','CLOSED','CANCELLED'));
ALTER TABLE [dbo].[Document] DROP CONSTRAINT [Document_status_ck];
ALTER TABLE [dbo].[Document] WITH CHECK ADD CONSTRAINT [Document_status_ck]
CHECK ([status] IN ('REQUESTED','AVAILABLE','VERIFIED','REJECTED','REUPLOAD_REQUIRED','EXPIRED'));
ALTER TABLE [dbo].[FieldVisit] DROP CONSTRAINT [FieldVisit_status_ck];
ALTER TABLE [dbo].[FieldVisit] WITH CHECK ADD CONSTRAINT [FieldVisit_status_ck]
CHECK ([status] IN ('ASSIGNED','IN_PROGRESS','REVIEW_PENDING','EXCEPTION_REVIEW','COMPLETED','CANCELLED'));
ALTER TABLE [dbo].[Report] DROP CONSTRAINT [Report_status_ck];
ALTER TABLE [dbo].[Report] WITH CHECK ADD CONSTRAINT [Report_status_ck]
CHECK ([status] IN ('QUEUED','PREPARED','PUBLISHED','FAILED'));
ALTER TABLE [dbo].[VerificationMethodRun] WITH CHECK ADD CONSTRAINT [VerificationMethodRun_method_ck]
CHECK ([method] IN ('DIGITAL','MANUAL','THIRD_PARTY'));
ALTER TABLE [dbo].[VerificationMethodRun] WITH CHECK ADD CONSTRAINT [VerificationMethodRun_status_ck]
CHECK ([status] IN ('REQUESTED','RESPONDED','SUPERSEDED'));
ALTER TABLE [dbo].[ManagerReview] WITH CHECK ADD CONSTRAINT [ManagerReview_decision_ck]
CHECK ([decision] IN ('APPROVED','REWORK','REOPENED'));

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
