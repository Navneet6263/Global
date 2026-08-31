CREATE TABLE [dbo].[TenantCrmSettings] (
  [id] BIGINT IDENTITY(1,1) NOT NULL,
  [publicId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [TenantCrmSettings_publicId_df] DEFAULT NEWID(),
  [tenantId] BIGINT NOT NULL,
  [newProbability] INT NOT NULL CONSTRAINT [TenantCrmSettings_newProbability_df] DEFAULT 10,
  [qualifiedProbability] INT NOT NULL CONSTRAINT [TenantCrmSettings_qualifiedProbability_df] DEFAULT 30,
  [proposalProbability] INT NOT NULL CONSTRAINT [TenantCrmSettings_proposalProbability_df] DEFAULT 55,
  [negotiationProbability] INT NOT NULL CONSTRAINT [TenantCrmSettings_negotiationProbability_df] DEFAULT 75,
  [wonProbability] INT NOT NULL CONSTRAINT [TenantCrmSettings_wonProbability_df] DEFAULT 100,
  [lostProbability] INT NOT NULL CONSTRAINT [TenantCrmSettings_lostProbability_df] DEFAULT 0,
  [leadSourcesJson] NVARCHAR(MAX) NOT NULL CONSTRAINT [TenantCrmSettings_leadSourcesJson_df]
    DEFAULT N'["INBOUND","OUTBOUND","REFERRAL","EVENT","PARTNER","MARKETPLACE"]',
  [version] INT NOT NULL CONSTRAINT [TenantCrmSettings_version_df] DEFAULT 1,
  [createdAt] DATETIME2 NOT NULL CONSTRAINT [TenantCrmSettings_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
  [updatedAt] DATETIME2 NOT NULL,
  CONSTRAINT [TenantCrmSettings_pkey] PRIMARY KEY CLUSTERED ([id]),
  CONSTRAINT [TenantCrmSettings_probability_ck] CHECK (
    [newProbability] BETWEEN 0 AND 100 AND
    [qualifiedProbability] BETWEEN [newProbability] AND 100 AND
    [proposalProbability] BETWEEN [qualifiedProbability] AND 100 AND
    [negotiationProbability] BETWEEN [proposalProbability] AND 100 AND
    [wonProbability] = 100 AND [lostProbability] = 0
  ),
  CONSTRAINT [TenantCrmSettings_leadSourcesJson_ck] CHECK (ISJSON([leadSourcesJson]) = 1)
);

CREATE UNIQUE NONCLUSTERED INDEX [TenantCrmSettings_publicId_key]
ON [dbo].[TenantCrmSettings]([publicId]);

CREATE UNIQUE NONCLUSTERED INDEX [TenantCrmSettings_tenantId_key]
ON [dbo].[TenantCrmSettings]([tenantId]);

ALTER TABLE [dbo].[TenantCrmSettings]
ADD CONSTRAINT [TenantCrmSettings_tenantId_fkey]
FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
