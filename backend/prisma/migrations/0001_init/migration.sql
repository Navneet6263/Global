BEGIN TRY

BEGIN TRAN;

-- CreateSchema
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = N'dbo') EXEC sp_executesql N'CREATE SCHEMA [dbo];';

-- CreateTable
CREATE TABLE [dbo].[Tenant] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [code] VARCHAR(32) NOT NULL,
    [name] NVARCHAR(160) NOT NULL,
    [status] VARCHAR(24) NOT NULL CONSTRAINT [Tenant_status_df] DEFAULT 'ACTIVE',
    [timezone] VARCHAR(64) NOT NULL CONSTRAINT [Tenant_timezone_df] DEFAULT 'Asia/Kolkata',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Tenant_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Tenant_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Tenant_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
    CONSTRAINT [Tenant_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[Branch] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [code] VARCHAR(32) NOT NULL,
    [name] NVARCHAR(120) NOT NULL,
    [city] NVARCHAR(80),
    [isActive] BIT NOT NULL CONSTRAINT [Branch_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Branch_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Branch_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Branch_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
    CONSTRAINT [Branch_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[User] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [branchId] BIGINT,
    [clientId] BIGINT,
    [email] VARCHAR(254) NOT NULL,
    [normalizedEmail] VARCHAR(254) NOT NULL,
    [displayName] NVARCHAR(120) NOT NULL,
    [phone] VARCHAR(24),
    [passwordHash] VARCHAR(255) NOT NULL,
    [status] VARCHAR(24) NOT NULL CONSTRAINT [User_status_df] DEFAULT 'ACTIVE',
    [failedLoginCount] INT NOT NULL CONSTRAINT [User_failedLoginCount_df] DEFAULT 0,
    [lockedUntil] DATETIME2,
    [lastLoginAt] DATETIME2,
    [passwordChangedAt] DATETIME2 NOT NULL CONSTRAINT [User_passwordChangedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [User_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [User_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [User_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
    CONSTRAINT [User_tenantId_normalizedEmail_key] UNIQUE NONCLUSTERED ([tenantId],[normalizedEmail])
);

-- CreateTable
CREATE TABLE [dbo].[Role] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [code] VARCHAR(48) NOT NULL,
    [name] NVARCHAR(100) NOT NULL,
    [permissionsJson] NVARCHAR(max) NOT NULL CONSTRAINT [Role_permissionsJson_df] DEFAULT '[]',
    [isSystem] BIT NOT NULL CONSTRAINT [Role_isSystem_df] DEFAULT 0,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Role_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Role_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Role_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
    CONSTRAINT [Role_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[UserRole] (
    [userId] BIGINT NOT NULL,
    [roleId] BIGINT NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [UserRole_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [UserRole_pkey] PRIMARY KEY CLUSTERED ([userId],[roleId])
);

-- CreateTable
CREATE TABLE [dbo].[RefreshSession] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [userId] BIGINT NOT NULL,
    [tokenHash] CHAR(64) NOT NULL,
    [userAgent] NVARCHAR(500),
    [ipAddress] VARCHAR(64),
    [expiresAt] DATETIME2 NOT NULL,
    [revokedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [RefreshSession_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [RefreshSession_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [RefreshSession_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
    CONSTRAINT [RefreshSession_tokenHash_key] UNIQUE NONCLUSTERED ([tokenHash])
);

-- CreateTable
CREATE TABLE [dbo].[Client] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [code] VARCHAR(32) NOT NULL,
    [legalName] NVARCHAR(180) NOT NULL,
    [displayName] NVARCHAR(120) NOT NULL,
    [contactName] NVARCHAR(120),
    [contactEmail] VARCHAR(254),
    [contactPhone] VARCHAR(24),
    [status] VARCHAR(24) NOT NULL CONSTRAINT [Client_status_df] DEFAULT 'ACTIVE',
    [billingTerms] NVARCHAR(200),
    [slaHours] INT NOT NULL CONSTRAINT [Client_slaHours_df] DEFAULT 72,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Client_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Client_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Client_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
    CONSTRAINT [Client_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[ServicePackage] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [code] VARCHAR(40) NOT NULL,
    [name] NVARCHAR(120) NOT NULL,
    [checksJson] NVARCHAR(max) NOT NULL,
    [price] DECIMAL(18,2),
    [tatHours] INT NOT NULL CONSTRAINT [ServicePackage_tatHours_df] DEFAULT 72,
    [isActive] BIT NOT NULL CONSTRAINT [ServicePackage_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ServicePackage_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [ServicePackage_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ServicePackage_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
    CONSTRAINT [ServicePackage_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[Subject] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [fullName] NVARCHAR(160) NOT NULL,
    [email] VARCHAR(254),
    [phone] VARCHAR(24),
    [dateOfBirth] DATE,
    [employeeCode] VARCHAR(64),
    [piiCiphertext] NVARCHAR(max),
    [piiKeyVersion] INT NOT NULL CONSTRAINT [Subject_piiKeyVersion_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Subject_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Subject_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Subject_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);

-- CreateTable
CREATE TABLE [dbo].[VerificationCase] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [branchId] BIGINT,
    [clientId] BIGINT NOT NULL,
    [subjectId] BIGINT NOT NULL,
    [assignedOpsUserId] BIGINT,
    [caseNumber] VARCHAR(32) NOT NULL,
    [externalRef] VARCHAR(80),
    [status] VARCHAR(32) NOT NULL CONSTRAINT [VerificationCase_status_df] DEFAULT 'DRAFT',
    [priority] VARCHAR(16) NOT NULL CONSTRAINT [VerificationCase_priority_df] DEFAULT 'NORMAL',
    [dueAt] DATETIME2,
    [completedAt] DATETIME2,
    [riskLevel] VARCHAR(16),
    [version] INT NOT NULL CONSTRAINT [VerificationCase_version_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [VerificationCase_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [VerificationCase_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [VerificationCase_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
    CONSTRAINT [VerificationCase_tenantId_caseNumber_key] UNIQUE NONCLUSTERED ([tenantId],[caseNumber])
);

-- CreateTable
CREATE TABLE [dbo].[CaseCheck] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [caseId] BIGINT NOT NULL,
    [type] VARCHAR(40) NOT NULL,
    [status] VARCHAR(32) NOT NULL CONSTRAINT [CaseCheck_status_df] DEFAULT 'PENDING',
    [result] VARCHAR(24),
    [riskLevel] VARCHAR(16),
    [dueAt] DATETIME2,
    [completedAt] DATETIME2,
    [sourceSummary] NVARCHAR(1000),
    [version] INT NOT NULL CONSTRAINT [CaseCheck_version_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CaseCheck_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CaseCheck_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CaseCheck_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
    CONSTRAINT [CaseCheck_caseId_type_key] UNIQUE NONCLUSTERED ([caseId],[type])
);

-- CreateTable
CREATE TABLE [dbo].[CaseStatusHistory] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [caseId] BIGINT NOT NULL,
    [fromStatus] VARCHAR(32),
    [toStatus] VARCHAR(32) NOT NULL,
    [changedById] BIGINT,
    [reason] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CaseStatusHistory_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [CaseStatusHistory_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Consent] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [caseId] BIGINT NOT NULL,
    [status] VARCHAR(24) NOT NULL CONSTRAINT [Consent_status_df] DEFAULT 'REQUESTED',
    [purpose] NVARCHAR(500) NOT NULL,
    [noticeVersion] VARCHAR(32) NOT NULL,
    [otpHash] CHAR(64),
    [otpExpiresAt] DATETIME2,
    [acceptedAt] DATETIME2,
    [withdrawnAt] DATETIME2,
    [ipAddress] VARCHAR(64),
    [userAgent] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Consent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Consent_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Consent_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);

-- CreateTable
CREATE TABLE [dbo].[ConsentEvent] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [consentId] BIGINT NOT NULL,
    [eventType] VARCHAR(32) NOT NULL,
    [evidenceJson] NVARCHAR(max) NOT NULL,
    [occurredAt] DATETIME2 NOT NULL CONSTRAINT [ConsentEvent_occurredAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ConsentEvent_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[Document] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [caseId] BIGINT NOT NULL,
    [type] VARCHAR(48) NOT NULL,
    [status] VARCHAR(24) NOT NULL CONSTRAINT [Document_status_df] DEFAULT 'REQUESTED',
    [currentVersion] INT NOT NULL CONSTRAINT [Document_currentVersion_df] DEFAULT 0,
    [expiresAt] DATE,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Document_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Document_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Document_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);

-- CreateTable
CREATE TABLE [dbo].[DocumentVersion] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [documentId] BIGINT NOT NULL,
    [version] INT NOT NULL,
    [objectKey] NVARCHAR(500) NOT NULL,
    [originalName] NVARCHAR(255) NOT NULL,
    [contentType] VARCHAR(100) NOT NULL,
    [sizeBytes] BIGINT NOT NULL,
    [sha256] CHAR(64) NOT NULL,
    [malwareState] VARCHAR(24) NOT NULL CONSTRAINT [DocumentVersion_malwareState_df] DEFAULT 'PENDING',
    [uploadedById] BIGINT,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DocumentVersion_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [DocumentVersion_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [DocumentVersion_documentId_version_key] UNIQUE NONCLUSTERED ([documentId],[version])
);

-- CreateTable
CREATE TABLE [dbo].[CheckTask] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [checkId] BIGINT NOT NULL,
    [assigneeId] BIGINT,
    [completedById] BIGINT,
    [status] VARCHAR(24) NOT NULL CONSTRAINT [CheckTask_status_df] DEFAULT 'OPEN',
    [instructions] NVARCHAR(1000),
    [dueAt] DATETIME2,
    [startedAt] DATETIME2,
    [completedAt] DATETIME2,
    [version] INT NOT NULL CONSTRAINT [CheckTask_version_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CheckTask_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CheckTask_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CheckTask_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);

-- CreateTable
CREATE TABLE [dbo].[Finding] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [checkId] BIGINT NOT NULL,
    [kind] VARCHAR(40) NOT NULL,
    [severity] VARCHAR(16) NOT NULL,
    [title] NVARCHAR(180) NOT NULL,
    [description] NVARCHAR(max) NOT NULL,
    [source] NVARCHAR(500),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Finding_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Finding_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Finding_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);

-- CreateTable
CREATE TABLE [dbo].[Clarification] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [caseId] BIGINT NOT NULL,
    [checkId] BIGINT,
    [status] VARCHAR(24) NOT NULL CONSTRAINT [Clarification_status_df] DEFAULT 'OPEN',
    [subject] NVARCHAR(180) NOT NULL,
    [dueAt] DATETIME2,
    [resolvedAt] DATETIME2,
    [responseTokenHash] CHAR(64),
    [responseTokenExpiresAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Clarification_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Clarification_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Clarification_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);

-- CreateTable
CREATE TABLE [dbo].[ClarificationMessage] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [clarificationId] BIGINT NOT NULL,
    [senderUserId] BIGINT,
    [senderType] VARCHAR(24) NOT NULL,
    [body] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [ClarificationMessage_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ClarificationMessage_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[QaReview] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [caseId] BIGINT NOT NULL,
    [reviewerId] BIGINT NOT NULL,
    [decision] VARCHAR(24) NOT NULL,
    [notes] NVARCHAR(2000),
    [checklistJson] NVARCHAR(max) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [QaReview_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [QaReview_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [QaReview_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);

-- CreateTable
CREATE TABLE [dbo].[Report] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [caseId] BIGINT NOT NULL,
    [status] VARCHAR(24) NOT NULL CONSTRAINT [Report_status_df] DEFAULT 'QUEUED',
    [currentVersion] INT NOT NULL CONSTRAINT [Report_currentVersion_df] DEFAULT 0,
    [publishedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Report_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Report_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Report_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);

-- CreateTable
CREATE TABLE [dbo].[ReportVersion] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [reportId] BIGINT NOT NULL,
    [version] INT NOT NULL,
    [objectKey] NVARCHAR(500) NOT NULL,
    [sha256] CHAR(64) NOT NULL,
    [authenticityCode] VARCHAR(32) NOT NULL,
    [generatedById] BIGINT,
    [generatedAt] DATETIME2 NOT NULL CONSTRAINT [ReportVersion_generatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [ReportVersion_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [ReportVersion_authenticityCode_key] UNIQUE NONCLUSTERED ([authenticityCode]),
    CONSTRAINT [ReportVersion_reportId_version_key] UNIQUE NONCLUSTERED ([reportId],[version])
);

-- CreateTable
CREATE TABLE [dbo].[FieldVisit] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [caseId] BIGINT NOT NULL,
    [assigneeId] BIGINT,
    [completedById] BIGINT,
    [status] VARCHAR(24) NOT NULL CONSTRAINT [FieldVisit_status_df] DEFAULT 'ASSIGNED',
    [address] NVARCHAR(500) NOT NULL,
    [targetLatitude] DECIMAL(9,6),
    [targetLongitude] DECIMAL(9,6),
    [geofenceMeters] INT NOT NULL CONSTRAINT [FieldVisit_geofenceMeters_df] DEFAULT 150,
    [capturedLatitude] DECIMAL(9,6),
    [capturedLongitude] DECIMAL(9,6),
    [accuracyMeters] DECIMAL(9,2),
    [distanceMeters] DECIMAL(10,2),
    [capturedAt] DATETIME2,
    [completedAt] DATETIME2,
    [checklistJson] NVARCHAR(max),
    [remarks] NVARCHAR(2000),
    [version] INT NOT NULL CONSTRAINT [FieldVisit_version_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [FieldVisit_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [FieldVisit_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [FieldVisit_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);

-- CreateTable
CREATE TABLE [dbo].[EvidenceItem] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [fieldVisitId] BIGINT NOT NULL,
    [uploadedById] BIGINT NOT NULL,
    [type] VARCHAR(32) NOT NULL,
    [objectKey] NVARCHAR(500) NOT NULL,
    [contentType] VARCHAR(100) NOT NULL,
    [sizeBytes] BIGINT NOT NULL,
    [sha256] CHAR(64) NOT NULL,
    [capturedAt] DATETIME2 NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [EvidenceItem_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [EvidenceItem_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [EvidenceItem_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);

-- CreateTable
CREATE TABLE [dbo].[AuditEvent] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [actorUserId] BIGINT,
    [action] VARCHAR(80) NOT NULL,
    [resourceType] VARCHAR(60) NOT NULL,
    [resourcePublicId] VARCHAR(64),
    [requestId] VARCHAR(64),
    [ipAddress] VARCHAR(64),
    [beforeJson] NVARCHAR(max),
    [afterJson] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [AuditEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [AuditEvent_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [AuditEvent_publicId_key] UNIQUE NONCLUSTERED ([publicId])
);

-- CreateTable
CREATE TABLE [dbo].[OutboxEvent] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [tenantId] BIGINT NOT NULL,
    [topic] VARCHAR(100) NOT NULL,
    [aggregateType] VARCHAR(60) NOT NULL,
    [aggregateId] VARCHAR(64) NOT NULL,
    [payloadJson] NVARCHAR(max) NOT NULL,
    [status] VARCHAR(24) NOT NULL CONSTRAINT [OutboxEvent_status_df] DEFAULT 'PENDING',
    [attempts] INT NOT NULL CONSTRAINT [OutboxEvent_attempts_df] DEFAULT 0,
    [availableAt] DATETIME2 NOT NULL CONSTRAINT [OutboxEvent_availableAt_df] DEFAULT CURRENT_TIMESTAMP,
    [processedAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [OutboxEvent_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [OutboxEvent_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[IdempotencyKey] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [tenantId] BIGINT NOT NULL,
    [key] VARCHAR(100) NOT NULL,
    [route] VARCHAR(160) NOT NULL,
    [requestHash] CHAR(64) NOT NULL,
    [responseCode] INT,
    [responseJson] NVARCHAR(max),
    [expiresAt] DATETIME2 NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [IdempotencyKey_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [IdempotencyKey_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [IdempotencyKey_tenantId_key_route_key] UNIQUE NONCLUSTERED ([tenantId],[key],[route])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Branch_tenantId_isActive_idx] ON [dbo].[Branch]([tenantId], [isActive]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_tenantId_status_idx] ON [dbo].[User]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_tenantId_branchId_idx] ON [dbo].[User]([tenantId], [branchId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [User_tenantId_clientId_idx] ON [dbo].[User]([tenantId], [clientId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [RefreshSession_userId_expiresAt_idx] ON [dbo].[RefreshSession]([userId], [expiresAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Client_tenantId_status_displayName_idx] ON [dbo].[Client]([tenantId], [status], [displayName]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Subject_tenantId_fullName_idx] ON [dbo].[Subject]([tenantId], [fullName]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Subject_tenantId_email_idx] ON [dbo].[Subject]([tenantId], [email]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VerificationCase_tenantId_status_dueAt_idx] ON [dbo].[VerificationCase]([tenantId], [status], [dueAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VerificationCase_tenantId_clientId_createdAt_idx] ON [dbo].[VerificationCase]([tenantId], [clientId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VerificationCase_tenantId_assignedOpsUserId_status_idx] ON [dbo].[VerificationCase]([tenantId], [assignedOpsUserId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VerificationCase_tenantId_subjectId_idx] ON [dbo].[VerificationCase]([tenantId], [subjectId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CaseCheck_tenantId_status_dueAt_idx] ON [dbo].[CaseCheck]([tenantId], [status], [dueAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CaseStatusHistory_caseId_createdAt_idx] ON [dbo].[CaseStatusHistory]([caseId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Consent_caseId_status_idx] ON [dbo].[Consent]([caseId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ConsentEvent_consentId_occurredAt_idx] ON [dbo].[ConsentEvent]([consentId], [occurredAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Document_tenantId_caseId_status_idx] ON [dbo].[Document]([tenantId], [caseId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [DocumentVersion_sha256_idx] ON [dbo].[DocumentVersion]([sha256]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CheckTask_tenantId_assigneeId_status_dueAt_idx] ON [dbo].[CheckTask]([tenantId], [assigneeId], [status], [dueAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CheckTask_checkId_status_idx] ON [dbo].[CheckTask]([checkId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Finding_checkId_severity_idx] ON [dbo].[Finding]([checkId], [severity]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Clarification_tenantId_caseId_status_idx] ON [dbo].[Clarification]([tenantId], [caseId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [ClarificationMessage_clarificationId_createdAt_idx] ON [dbo].[ClarificationMessage]([clarificationId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [QaReview_caseId_createdAt_idx] ON [dbo].[QaReview]([caseId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [QaReview_reviewerId_createdAt_idx] ON [dbo].[QaReview]([reviewerId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Report_tenantId_caseId_status_idx] ON [dbo].[Report]([tenantId], [caseId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FieldVisit_tenantId_assigneeId_status_idx] ON [dbo].[FieldVisit]([tenantId], [assigneeId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [FieldVisit_tenantId_caseId_idx] ON [dbo].[FieldVisit]([tenantId], [caseId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [EvidenceItem_fieldVisitId_capturedAt_idx] ON [dbo].[EvidenceItem]([fieldVisitId], [capturedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditEvent_tenantId_resourceType_resourcePublicId_createdAt_idx] ON [dbo].[AuditEvent]([tenantId], [resourceType], [resourcePublicId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [AuditEvent_tenantId_actorUserId_createdAt_idx] ON [dbo].[AuditEvent]([tenantId], [actorUserId], [createdAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OutboxEvent_status_availableAt_idx] ON [dbo].[OutboxEvent]([status], [availableAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [OutboxEvent_tenantId_aggregateType_aggregateId_idx] ON [dbo].[OutboxEvent]([tenantId], [aggregateType], [aggregateId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [IdempotencyKey_expiresAt_idx] ON [dbo].[IdempotencyKey]([expiresAt]);

-- AddForeignKey
ALTER TABLE [dbo].[Branch] ADD CONSTRAINT [Branch_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[Branch]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[User] ADD CONSTRAINT [User_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Role] ADD CONSTRAINT [Role_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UserRole] ADD CONSTRAINT [UserRole_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[UserRole] ADD CONSTRAINT [UserRole_roleId_fkey] FOREIGN KEY ([roleId]) REFERENCES [dbo].[Role]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[RefreshSession] ADD CONSTRAINT [RefreshSession_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Client] ADD CONSTRAINT [Client_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ServicePackage] ADD CONSTRAINT [ServicePackage_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Subject] ADD CONSTRAINT [Subject_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VerificationCase] ADD CONSTRAINT [VerificationCase_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VerificationCase] ADD CONSTRAINT [VerificationCase_branchId_fkey] FOREIGN KEY ([branchId]) REFERENCES [dbo].[Branch]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VerificationCase] ADD CONSTRAINT [VerificationCase_clientId_fkey] FOREIGN KEY ([clientId]) REFERENCES [dbo].[Client]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VerificationCase] ADD CONSTRAINT [VerificationCase_subjectId_fkey] FOREIGN KEY ([subjectId]) REFERENCES [dbo].[Subject]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[VerificationCase] ADD CONSTRAINT [VerificationCase_assignedOpsUserId_fkey] FOREIGN KEY ([assignedOpsUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CaseCheck] ADD CONSTRAINT [CaseCheck_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CaseCheck] ADD CONSTRAINT [CaseCheck_caseId_fkey] FOREIGN KEY ([caseId]) REFERENCES [dbo].[VerificationCase]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CaseStatusHistory] ADD CONSTRAINT [CaseStatusHistory_caseId_fkey] FOREIGN KEY ([caseId]) REFERENCES [dbo].[VerificationCase]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Consent] ADD CONSTRAINT [Consent_caseId_fkey] FOREIGN KEY ([caseId]) REFERENCES [dbo].[VerificationCase]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ConsentEvent] ADD CONSTRAINT [ConsentEvent_consentId_fkey] FOREIGN KEY ([consentId]) REFERENCES [dbo].[Consent]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Document] ADD CONSTRAINT [Document_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Document] ADD CONSTRAINT [Document_caseId_fkey] FOREIGN KEY ([caseId]) REFERENCES [dbo].[VerificationCase]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DocumentVersion] ADD CONSTRAINT [DocumentVersion_documentId_fkey] FOREIGN KEY ([documentId]) REFERENCES [dbo].[Document]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CheckTask] ADD CONSTRAINT [CheckTask_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CheckTask] ADD CONSTRAINT [CheckTask_checkId_fkey] FOREIGN KEY ([checkId]) REFERENCES [dbo].[CaseCheck]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CheckTask] ADD CONSTRAINT [CheckTask_assigneeId_fkey] FOREIGN KEY ([assigneeId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CheckTask] ADD CONSTRAINT [CheckTask_completedById_fkey] FOREIGN KEY ([completedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Finding] ADD CONSTRAINT [Finding_checkId_fkey] FOREIGN KEY ([checkId]) REFERENCES [dbo].[CaseCheck]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Clarification] ADD CONSTRAINT [Clarification_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Clarification] ADD CONSTRAINT [Clarification_caseId_fkey] FOREIGN KEY ([caseId]) REFERENCES [dbo].[VerificationCase]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ClarificationMessage] ADD CONSTRAINT [ClarificationMessage_clarificationId_fkey] FOREIGN KEY ([clarificationId]) REFERENCES [dbo].[Clarification]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ClarificationMessage] ADD CONSTRAINT [ClarificationMessage_senderUserId_fkey] FOREIGN KEY ([senderUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[QaReview] ADD CONSTRAINT [QaReview_caseId_fkey] FOREIGN KEY ([caseId]) REFERENCES [dbo].[VerificationCase]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[QaReview] ADD CONSTRAINT [QaReview_reviewerId_fkey] FOREIGN KEY ([reviewerId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Report] ADD CONSTRAINT [Report_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Report] ADD CONSTRAINT [Report_caseId_fkey] FOREIGN KEY ([caseId]) REFERENCES [dbo].[VerificationCase]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ReportVersion] ADD CONSTRAINT [ReportVersion_reportId_fkey] FOREIGN KEY ([reportId]) REFERENCES [dbo].[Report]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[ReportVersion] ADD CONSTRAINT [ReportVersion_generatedById_fkey] FOREIGN KEY ([generatedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FieldVisit] ADD CONSTRAINT [FieldVisit_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FieldVisit] ADD CONSTRAINT [FieldVisit_caseId_fkey] FOREIGN KEY ([caseId]) REFERENCES [dbo].[VerificationCase]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FieldVisit] ADD CONSTRAINT [FieldVisit_assigneeId_fkey] FOREIGN KEY ([assigneeId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[FieldVisit] ADD CONSTRAINT [FieldVisit_completedById_fkey] FOREIGN KEY ([completedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EvidenceItem] ADD CONSTRAINT [EvidenceItem_fieldVisitId_fkey] FOREIGN KEY ([fieldVisitId]) REFERENCES [dbo].[FieldVisit]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[EvidenceItem] ADD CONSTRAINT [EvidenceItem_uploadedById_fkey] FOREIGN KEY ([uploadedById]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AuditEvent] ADD CONSTRAINT [AuditEvent_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[AuditEvent] ADD CONSTRAINT [AuditEvent_actorUserId_fkey] FOREIGN KEY ([actorUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OutboxEvent] ADD CONSTRAINT [OutboxEvent_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[IdempotencyKey] ADD CONSTRAINT [IdempotencyKey_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
