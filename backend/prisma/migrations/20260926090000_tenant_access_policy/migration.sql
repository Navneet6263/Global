-- Platform Admin controlled delegation switches. Every delegation defaults to OFF.
CREATE TABLE [dbo].[TenantAccessPolicy] (
  [id] BIGINT IDENTITY(1,1) NOT NULL,
  [publicId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [TenantAccessPolicy_publicId_df] DEFAULT NEWID(),
  [tenantId] BIGINT NOT NULL,
  [opsUserCreationEnabled] BIT NOT NULL CONSTRAINT [TenantAccessPolicy_opsUserCreationEnabled_df] DEFAULT 0,
  [version] INT NOT NULL CONSTRAINT [TenantAccessPolicy_version_df] DEFAULT 1,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [TenantAccessPolicy_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [TenantAccessPolicy_pkey] PRIMARY KEY CLUSTERED ([id])
);

CREATE UNIQUE NONCLUSTERED INDEX [TenantAccessPolicy_publicId_key]
ON [dbo].[TenantAccessPolicy]([publicId]);

CREATE UNIQUE NONCLUSTERED INDEX [TenantAccessPolicy_tenantId_key]
ON [dbo].[TenantAccessPolicy]([tenantId]);

ALTER TABLE [dbo].[TenantAccessPolicy]
ADD CONSTRAINT [TenantAccessPolicy_tenantId_fkey]
FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
