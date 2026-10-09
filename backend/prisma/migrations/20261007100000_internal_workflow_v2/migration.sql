BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[VerificationCase] ADD [dataEntryAssignedAt] DATETIME2,
[dataEntryReadyAt] DATETIME2,
[dataEntryUserId] BIGINT,
[intakeStage] VARCHAR(24),
[workflowVersion] INT NOT NULL CONSTRAINT [VerificationCase_workflowVersion_df] DEFAULT 1;

-- AlterTable
ALTER TABLE [dbo].[CaseCheck] ADD [departmentId] BIGINT,
[routedAt] DATETIME2;

-- AlterTable
ALTER TABLE [dbo].[Clarification] ADD [level] VARCHAR(8),
[raisedById] BIGINT;

-- CreateTable
CREATE TABLE [dbo].[Department] (
    [id] BIGINT NOT NULL IDENTITY(1,1),
    [publicId] UNIQUEIDENTIFIER NOT NULL,
    [tenantId] BIGINT NOT NULL,
    [code] VARCHAR(32) NOT NULL,
    [name] NVARCHAR(80) NOT NULL,
    [kind] VARCHAR(16) NOT NULL,
    [checkTypesJson] NVARCHAR(1000) NOT NULL CONSTRAINT [Department_checkTypesJson_df] DEFAULT '[]',
    [status] VARCHAR(16) NOT NULL CONSTRAINT [Department_status_df] DEFAULT 'ACTIVE',
    [version] INT NOT NULL CONSTRAINT [Department_version_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [Department_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [Department_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Department_publicId_key] UNIQUE NONCLUSTERED ([publicId]),
    CONSTRAINT [Department_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[DepartmentMember] (
    [departmentId] BIGINT NOT NULL,
    [userId] BIGINT NOT NULL,
    [role] VARCHAR(16) NOT NULL CONSTRAINT [DepartmentMember_role_df] DEFAULT 'MEMBER',
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [DepartmentMember_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [DepartmentMember_pkey] PRIMARY KEY CLUSTERED ([departmentId],[userId])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Department_tenantId_kind_status_idx] ON [dbo].[Department]([tenantId], [kind], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [DepartmentMember_userId_role_idx] ON [dbo].[DepartmentMember]([userId], [role]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VerificationCase_tenantId_dataEntryUserId_intakeStage_idx] ON [dbo].[VerificationCase]([tenantId], [dataEntryUserId], [intakeStage]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [VerificationCase_tenantId_intakeStage_updatedAt_idx] ON [dbo].[VerificationCase]([tenantId], [intakeStage], [updatedAt]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [CaseCheck_tenantId_departmentId_status_idx] ON [dbo].[CaseCheck]([tenantId], [departmentId], [status]);

-- AddForeignKey
ALTER TABLE [dbo].[VerificationCase] ADD CONSTRAINT [VerificationCase_dataEntryUserId_fkey] FOREIGN KEY ([dataEntryUserId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[CaseCheck] ADD CONSTRAINT [CaseCheck_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[Department] ADD CONSTRAINT [Department_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DepartmentMember] ADD CONSTRAINT [DepartmentMember_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[Department]([id]) ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[DepartmentMember] ADD CONSTRAINT [DepartmentMember_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[User]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Data Entry users review intake, raise L1 insufficiency and mark cases Ready.
-- Write actions are served only by the role-gated /workflow module.
INSERT INTO [dbo].[Role] ([publicId], [tenantId], [code], [name], [permissionsJson], [isSystem], [updatedAt])
SELECT NEWID(), [t].[id], 'DATA_ENTRY', 'Data Entry',
       '["dashboard:read","notification:read","case:read","document:read","clarification:read","clarification:write"]',
       1, SYSUTCDATETIME()
FROM [dbo].[Tenant] AS [t]
WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[Role] AS [r]
    WHERE [r].[tenantId] = [t].[id] AND [r].[code] = 'DATA_ENTRY'
);

-- Default operational departments. Admins can rename, deactivate or add more later.
INSERT INTO [dbo].[Department] ([publicId], [tenantId], [code], [name], [kind], [checkTypesJson], [updatedAt])
SELECT NEWID(), [t].[id], [d].[code], [d].[name], [d].[kind], [d].[checkTypesJson], SYSUTCDATETIME()
FROM [dbo].[Tenant] AS [t]
CROSS JOIN (VALUES
    ('DATA_ENTRY', N'Data Entry', 'DATA_ENTRY', N'[]'),
    ('EMPLOYMENT', N'Employment', 'VERIFICATION', N'["EMPLOYMENT","REFERENCE"]'),
    ('EDUCATION', N'Education', 'VERIFICATION', N'["EDUCATION"]'),
    ('ADDRESS', N'Address / DAV', 'VERIFICATION', N'["ADDRESS"]')
) AS [d] ([code], [name], [kind], [checkTypesJson])
WHERE NOT EXISTS (
    SELECT 1 FROM [dbo].[Department] AS [x]
    WHERE [x].[tenantId] = [t].[id] AND [x].[code] = [d].[code]
);

-- The responsible RM gains read-only evidence access; RM actions are role-gated in /workflow.
UPDATE [dbo].[Role]
SET [permissionsJson] = '["dashboard:read","notification:read","vendor:assign","case:read","document:read","clarification:read","report:read"]',
    [updatedAt] = SYSUTCDATETIME()
WHERE [code] = 'SPOC_RM' AND [isSystem] = 1;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

