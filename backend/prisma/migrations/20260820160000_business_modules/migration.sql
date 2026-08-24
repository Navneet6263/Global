BEGIN TRY

BEGIN TRAN;

ALTER TABLE [dbo].[User] ADD [mustChangePassword] BIT NOT NULL CONSTRAINT [User_mustChangePassword_df] DEFAULT 1;
ALTER TABLE [dbo].[User] ADD [version] INT NOT NULL CONSTRAINT [User_version_df] DEFAULT 1;
ALTER TABLE [dbo].[Client] ADD [version] INT NOT NULL CONSTRAINT [Client_version_df] DEFAULT 1;
ALTER TABLE [dbo].[Consent] ADD [otpAttempts] INT NOT NULL CONSTRAINT [Consent_otpAttempts_df] DEFAULT 0;
ALTER TABLE [dbo].[Consent] ADD [otpLastIssuedAt] DATETIME2;
ALTER TABLE [dbo].[RefreshSession] ADD [familyId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [RefreshSession_familyId_df] DEFAULT NEWID();
ALTER TABLE [dbo].[RefreshSession] DROP CONSTRAINT [RefreshSession_familyId_df];
CREATE NONCLUSTERED INDEX [RefreshSession_userId_familyId_idx] ON [dbo].[RefreshSession]([userId], [familyId]);
ALTER TABLE [dbo].[FieldVisit] ADD [evidenceSince] DATETIME2 NOT NULL CONSTRAINT [FieldVisit_evidenceSince_df] DEFAULT CURRENT_TIMESTAMP;
EXEC sys.sp_executesql N'UPDATE [dbo].[User] SET [mustChangePassword] = 0';

CREATE TABLE [dbo].[TenantFieldPolicy] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [defaultRadiusMeters] INT NOT NULL CONSTRAINT [TenantFieldPolicy_defaultRadiusMeters_df] DEFAULT 150,
    [maxAccuracyMeters] INT NOT NULL CONSTRAINT [TenantFieldPolicy_maxAccuracyMeters_df] DEFAULT 50,
    [minimumPhotos] INT NOT NULL CONSTRAINT [TenantFieldPolicy_minimumPhotos_df] DEFAULT 2,
    [retentionDays] INT NOT NULL CONSTRAINT [TenantFieldPolicy_retentionDays_df] DEFAULT 365,
    [requireCheckout] BIT NOT NULL CONSTRAINT [TenantFieldPolicy_requireCheckout_df] DEFAULT 1,
    [outsideGeofencePolicy] VARCHAR(32) NOT NULL CONSTRAINT [TenantFieldPolicy_outsideGeofencePolicy_df] DEFAULT 'SUPERVISOR_APPROVAL',
    [version] INT NOT NULL CONSTRAINT [TenantFieldPolicy_version_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [TenantFieldPolicy_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [TenantFieldPolicy_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [TenantFieldPolicy_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
    CONSTRAINT [TenantFieldPolicy_tenantId_key] UNIQUE NONCLUSTERED ([tenantId])
);

CREATE TABLE [dbo].[SalesOpportunity] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [clientId] BIGINT,
    [ownerId] BIGINT,
    [companyName] NVARCHAR(180) NOT NULL,
    [contactName] NVARCHAR(120) NOT NULL,
    [contactEmail] VARCHAR(254),
    [contactPhone] VARCHAR(24),
    [stage] VARCHAR(32) NOT NULL CONSTRAINT [SalesOpportunity_stage_df] DEFAULT 'NEW',
    [source] VARCHAR(48),
    [estimatedValue] DECIMAL(18,2) NOT NULL CONSTRAINT [SalesOpportunity_estimatedValue_df] DEFAULT 0,
    [probability] INT NOT NULL CONSTRAINT [SalesOpportunity_probability_df] DEFAULT 10,
    [expectedCloseDate] DATE,
    [notes] NVARCHAR(2000),
    [closedAt] DATETIME2,
    [version] INT NOT NULL CONSTRAINT [SalesOpportunity_version_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SalesOpportunity_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [SalesOpportunity_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SalesOpportunity_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);

CREATE TABLE [dbo].[SalesActivity] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [opportunityId] BIGINT NOT NULL,
    [actorUserId] BIGINT NOT NULL,
    [type] VARCHAR(32) NOT NULL,
    [summary] NVARCHAR(1000) NOT NULL,
    [occurredAt] DATETIME2 NOT NULL CONSTRAINT [SalesActivity_occurredAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [SalesActivity_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [SalesActivity_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [SalesActivity_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);

CREATE TABLE [dbo].[Invoice] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [clientId] BIGINT NOT NULL,
    [invoiceNumber] VARCHAR(40) NOT NULL,
    [status] VARCHAR(24) NOT NULL CONSTRAINT [Invoice_status_df] DEFAULT 'DRAFT',
    [currency] CHAR(3) NOT NULL CONSTRAINT [Invoice_currency_df] DEFAULT 'INR',
    [issuedAt] DATE,
    [dueAt] DATE,
    [subtotal] DECIMAL(18,2) NOT NULL CONSTRAINT [Invoice_subtotal_df] DEFAULT 0,
    [taxAmount] DECIMAL(18,2) NOT NULL CONSTRAINT [Invoice_taxAmount_df] DEFAULT 0,
    [totalAmount] DECIMAL(18,2) NOT NULL CONSTRAINT [Invoice_totalAmount_df] DEFAULT 0,
    [paidAmount] DECIMAL(18,2) NOT NULL CONSTRAINT [Invoice_paidAmount_df] DEFAULT 0,
    [notes] NVARCHAR(1000),
    [version] INT NOT NULL CONSTRAINT [Invoice_version_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Invoice_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Invoice_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Invoice_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
    CONSTRAINT [Invoice_tenantId_invoiceNumber_key] UNIQUE NONCLUSTERED ([tenantId], [invoiceNumber])
);

CREATE TABLE [dbo].[InvoiceLine] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [invoiceId] BIGINT NOT NULL,
    [caseId] BIGINT,
    [description] NVARCHAR(300) NOT NULL,
    [quantity] INT NOT NULL CONSTRAINT [InvoiceLine_quantity_df] DEFAULT 1,
    [unitPrice] DECIMAL(18,2) NOT NULL,
    [taxRate] DECIMAL(5,2) NOT NULL CONSTRAINT [InvoiceLine_taxRate_df] DEFAULT 0,
    [lineTotal] DECIMAL(18,2) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [InvoiceLine_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [InvoiceLine_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE TABLE [dbo].[Payment] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [invoiceId] BIGINT NOT NULL,
    [recordedById] BIGINT NOT NULL,
    [amount] DECIMAL(18,2) NOT NULL,
    [method] VARCHAR(32) NOT NULL,
    [reference] VARCHAR(100),
    [receivedAt] DATETIME2 NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Payment_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Payment_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Payment_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);

CREATE TABLE [dbo].[Notification] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [userId] BIGINT NOT NULL,
    [type] VARCHAR(48) NOT NULL,
    [title] NVARCHAR(160) NOT NULL,
    [body] NVARCHAR(1000) NOT NULL,
    [href] NVARCHAR(300),
    [readAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Notification_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Notification_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Notification_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);

CREATE TABLE [dbo].[CandidatePortalAccess] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [caseId] BIGINT NOT NULL,
    [tokenHash] CHAR(64) NOT NULL,
    [expiresAt] DATETIME2 NOT NULL,
    [revokedAt] DATETIME2,
    [lastAccessedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CandidatePortalAccess_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [CandidatePortalAccess_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CandidatePortalAccess_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);

CREATE NONCLUSTERED INDEX [SalesOpportunity_tenantId_stage_updatedAt_idx] ON [dbo].[SalesOpportunity]([tenantId], [stage], [updatedAt]);
CREATE NONCLUSTERED INDEX [SalesOpportunity_tenantId_ownerId_stage_idx] ON [dbo].[SalesOpportunity]([tenantId], [ownerId], [stage]);
CREATE NONCLUSTERED INDEX [SalesActivity_tenantId_occurredAt_idx] ON [dbo].[SalesActivity]([tenantId], [occurredAt]);
CREATE NONCLUSTERED INDEX [SalesActivity_opportunityId_occurredAt_idx] ON [dbo].[SalesActivity]([opportunityId], [occurredAt]);
CREATE NONCLUSTERED INDEX [Invoice_tenantId_status_dueAt_idx] ON [dbo].[Invoice]([tenantId], [status], [dueAt]);
CREATE NONCLUSTERED INDEX [Invoice_tenantId_clientId_createdAt_idx] ON [dbo].[Invoice]([tenantId], [clientId], [createdAt]);
CREATE NONCLUSTERED INDEX [InvoiceLine_invoiceId_idx] ON [dbo].[InvoiceLine]([invoiceId]);
CREATE NONCLUSTERED INDEX [InvoiceLine_caseId_idx] ON [dbo].[InvoiceLine]([caseId]);
CREATE NONCLUSTERED INDEX [Payment_invoiceId_receivedAt_idx] ON [dbo].[Payment]([invoiceId], [receivedAt]);
CREATE NONCLUSTERED INDEX [Notification_tenantId_userId_readAt_createdAt_idx] ON [dbo].[Notification]([tenantId], [userId], [readAt], [createdAt]);
CREATE NONCLUSTERED INDEX [CandidatePortalAccess_tenantId_caseId_expiresAt_idx] ON [dbo].[CandidatePortalAccess]([tenantId], [caseId], [expiresAt]);

ALTER TABLE [dbo].[TenantFieldPolicy] ADD CONSTRAINT [TenantFieldPolicy_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SalesOpportunity] ADD CONSTRAINT [SalesOpportunity_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SalesOpportunity] ADD CONSTRAINT [SalesOpportunity_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SalesOpportunity] ADD CONSTRAINT [SalesOpportunity_ownerId_fkey] FOREIGN KEY ([ownerId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SalesActivity] ADD CONSTRAINT [SalesActivity_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SalesActivity] ADD CONSTRAINT [SalesActivity_opportunityId_fkey] FOREIGN KEY ([opportunityId]) REFERENCES [dbo].[SalesOpportunity]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[SalesActivity] ADD CONSTRAINT [SalesActivity_actorUserId_fkey] FOREIGN KEY ([actorUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Invoice] ADD CONSTRAINT [Invoice_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Invoice] ADD CONSTRAINT [Invoice_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[InvoiceLine] ADD CONSTRAINT [InvoiceLine_invoiceId_fkey] FOREIGN KEY ([invoiceId]) REFERENCES [dbo].[Invoice]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[InvoiceLine] ADD CONSTRAINT [InvoiceLine_caseId_fkey] FOREIGN KEY ([caseId]) REFERENCES [dbo].[VerificationCase]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_invoiceId_fkey] FOREIGN KEY ([invoiceId]) REFERENCES [dbo].[Invoice]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Payment] ADD CONSTRAINT [Payment_recordedById_fkey] FOREIGN KEY ([recordedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Notification] ADD CONSTRAINT [Notification_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[Notification] ADD CONSTRAINT [Notification_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[CandidatePortalAccess] ADD CONSTRAINT [CandidatePortalAccess_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE [dbo].[CandidatePortalAccess] ADD CONSTRAINT [CandidatePortalAccess_caseId_fkey] FOREIGN KEY ([caseId]) REFERENCES [dbo].[VerificationCase]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE [dbo].[User] WITH CHECK ADD CONSTRAINT [User_status_ck] CHECK ([status] IN ('ACTIVE', 'SUSPENDED'));
ALTER TABLE [dbo].[Client] WITH CHECK ADD CONSTRAINT [Client_status_ck] CHECK ([status] IN ('ACTIVE', 'SUSPENDED'));
ALTER TABLE [dbo].[VerificationCase] WITH CHECK ADD CONSTRAINT [VerificationCase_status_ck] CHECK ([status] IN ('DRAFT', 'CONSENT_PENDING', 'DOCUMENT_PENDING', 'IN_PROGRESS', 'CLARIFICATION_PENDING', 'QA_REVIEW', 'COMPLETED', 'CLOSED', 'CANCELLED'));
ALTER TABLE [dbo].[VerificationCase] WITH CHECK ADD CONSTRAINT [VerificationCase_priority_ck] CHECK ([priority] IN ('LOW', 'NORMAL', 'HIGH', 'URGENT'));
ALTER TABLE [dbo].[CaseCheck] WITH CHECK ADD CONSTRAINT [CaseCheck_status_ck] CHECK ([status] IN ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'QA_REVIEW'));
ALTER TABLE [dbo].[CheckTask] WITH CHECK ADD CONSTRAINT [CheckTask_status_ck] CHECK ([status] IN ('UNASSIGNED', 'OPEN', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED'));
ALTER TABLE [dbo].[Consent] WITH CHECK ADD CONSTRAINT [Consent_status_ck] CHECK ([status] IN ('REQUESTED', 'ACCEPTED', 'WITHDRAWN', 'EXPIRED'));
ALTER TABLE [dbo].[Document] WITH CHECK ADD CONSTRAINT [Document_status_ck] CHECK ([status] IN ('REQUESTED', 'AVAILABLE', 'REJECTED', 'EXPIRED'));
ALTER TABLE [dbo].[Clarification] WITH CHECK ADD CONSTRAINT [Clarification_status_ck] CHECK ([status] IN ('OPEN', 'RESPONDED', 'RESOLVED', 'EXPIRED'));
ALTER TABLE [dbo].[FieldVisit] WITH CHECK ADD CONSTRAINT [FieldVisit_status_ck] CHECK ([status] IN ('ASSIGNED', 'IN_PROGRESS', 'EXCEPTION_REVIEW', 'COMPLETED', 'CANCELLED'));
ALTER TABLE [dbo].[OutboxEvent] WITH CHECK ADD CONSTRAINT [OutboxEvent_status_ck] CHECK ([status] IN ('PENDING', 'PROCESSING', 'RETRY', 'PROCESSED', 'FAILED'));
ALTER TABLE [dbo].[Report] WITH CHECK ADD CONSTRAINT [Report_status_ck] CHECK ([status] IN ('QUEUED', 'PUBLISHED', 'FAILED'));
ALTER TABLE [dbo].[TenantFieldPolicy] WITH CHECK ADD CONSTRAINT [TenantFieldPolicy_geofence_ck] CHECK ([defaultRadiusMeters] BETWEEN 50 AND 1000 AND [maxAccuracyMeters] BETWEEN 5 AND 500 AND [minimumPhotos] BETWEEN 1 AND 12 AND [retentionDays] BETWEEN 30 AND 3650 AND [outsideGeofencePolicy] IN ('BLOCK', 'SUPERVISOR_APPROVAL', 'ALLOW_AND_FLAG'));
ALTER TABLE [dbo].[SalesOpportunity] WITH CHECK ADD CONSTRAINT [SalesOpportunity_stage_ck] CHECK ([stage] IN ('NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST') AND [probability] BETWEEN 0 AND 100 AND [estimatedValue] >= 0);
ALTER TABLE [dbo].[Invoice] WITH CHECK ADD CONSTRAINT [Invoice_status_ck] CHECK ([status] IN ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED', 'OVERDUE') AND [subtotal] >= 0 AND [taxAmount] >= 0 AND [totalAmount] >= 0 AND [paidAmount] >= 0);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
